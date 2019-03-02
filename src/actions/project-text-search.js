/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

/**
 * Redux actions for the search state
 * @module actions/search
 */

import { findSourceMatches } from "../workers/search";
import { getSource, hasPrettySource, getSourceList } from "../selectors";
import { isThirdParty } from "../utils/source";
import { loadSourceText } from "./sources/loadSourceText";
import {
  statusType,
  getTextSearchOperation,
  getTextSearchStatus,
  getTextSearchModifiers,
  getTextSearchQuery
} from "../reducers/project-text-search";

import type { Action, ThunkArgs } from "./types";
import type { SearchModifiers } from "../types";
import type { SearchOperation } from "../reducers/project-text-search";

export function addSearchQuery(query: string): Action {
  return { type: "ADD_QUERY", query };
}

export function toggleProjectSearchModifier(modifier: string): Action {
  return { type: "TOGGLE_PROJECT_SEARCH_MODIFIER", modifier };
}

export function addOngoingSearch(ongoingSearch: SearchOperation): Action {
  return { type: "ADD_ONGOING_SEARCH", ongoingSearch };
}

export function addSearchResult(
  sourceId: string,
  filepath: string,
  matches: Object[]
): Action {
  return {
    type: "ADD_SEARCH_RESULT",
    result: { sourceId, filepath, matches }
  };
}

export function clearSearchResults(): Action {
  return { type: "CLEAR_SEARCH_RESULTS" };
}

export function clearSearch(): Action {
  return { type: "CLEAR_SEARCH" };
}

export function updateSearchStatus(status: string): Action {
  return { type: "UPDATE_STATUS", status };
}

export function closeProjectSearch() {
  return ({ dispatch, getState }: ThunkArgs) => {
    dispatch(stopOngoingSearch());
    dispatch({ type: "CLOSE_PROJECT_SEARCH" });
  };
}

export function stopOngoingSearch() {
  return ({ dispatch, getState }: ThunkArgs) => {
    const state = getState();
    const ongoingSearch = getTextSearchOperation(state);
    const status = getTextSearchStatus(state);
    if (ongoingSearch && status !== statusType.done) {
      ongoingSearch.cancel();
      dispatch(updateSearchStatus(statusType.cancelled));
    }
  };
}

export function searchSources() {
  let cancelled = false;

  const search = async ({ dispatch, getState }: ThunkArgs) => {
    const modifiers = getTextSearchModifiers(getState());
    const query = getTextSearchQuery(getState());

    dispatch(stopOngoingSearch());
    await dispatch(addOngoingSearch(search));
    await dispatch(clearSearchResults());
    dispatch(updateSearchStatus(statusType.fetching));
    const validSources = getSourceList(getState()).filter(
      source => !hasPrettySource(getState(), source.id) && !isThirdParty(source)
    );
    for (const source of validSources) {
      if (cancelled) {
        return;
      }
      await dispatch(loadSourceText(source));
      await dispatch(searchSource(source.id, query, modifiers));
    }
    dispatch(updateSearchStatus(statusType.done));
  };

  search.cancel = () => {
    cancelled = true;
  };

  return search;
}

export function searchSource(
  sourceId: string,
  query: string,
  modifiers: SearchModifiers
) {
  return async ({ dispatch, getState }: ThunkArgs) => {
    const source = getSource(getState(), sourceId);
    if (!source) {
      return;
    }

    const matches = await findSourceMatches(source, query, modifiers);
    if (!matches.length) {
      return;
    }
    dispatch(addSearchResult(source.id, source.url, matches));
  };
}
