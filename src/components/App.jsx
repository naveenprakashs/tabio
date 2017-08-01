import React, { Component } from 'react';
import glamorous from 'glamorous';
import fuzzysearch from 'fuzzysearch';

import FilterBar from './FilterBar';
import TabGroups from './TabGroups';

const Container = glamorous.div({
  display: 'flex',
  flexDirection: 'column',
  width: 400,
  maxHeight: 600,
  color: 'rgba(0, 0, 0, 0.7)',
});

class App extends Component {
  state = { filterTerm: '', tabGroups: [], currentTabGroupId: '' };

  componentDidMount() {
    chrome.windows.getCurrent({}, tabGroup => {
      this.setState({ currentTabGroupId: tabGroup.id });
    });

    // HACK: prevent popup window from getting stuck at the wrong size
    // https://bugs.chromium.org/p/chromium/issues/detail?id=428044
    setTimeout(() => {
      chrome.windows.getAll({ populate: true }, tabGroups => {
        this.setState({ tabGroups });
      });
    }, 100);
  }

  setFilterTerm = event => {
    this.setState({ filterTerm: event.target.value });
  };

  /** Move current tab group to the beginning of the list */
  sortTabGroups = (tabGroups, currentTabGroupId) => {
    if (tabGroups.length === 0 || currentTabGroupId === '') {
      return tabGroups;
    }

    // copy tabGroups
    const sortedTabGroups = tabGroups.slice();

    // find index of current tab group
    const currentTabGroupIndex = sortedTabGroups.findIndex(
      tabGroup => tabGroup.id === currentTabGroupId,
    );

    // remove current tab group from sortedTabGroups
    const currentTabGroup = sortedTabGroups.splice(currentTabGroupIndex, 1)[0];

    // add current tab group to beginning of sortedTabGroups
    sortedTabGroups.unshift(currentTabGroup);

    return sortedTabGroups;
  };

  /** Filter list of tabs based on filterTerm */
  filterTabGroup = (tabGroups, filterTerm) => {
    if (filterTerm === '') {
      return tabGroups;
    }

    return tabGroups
      .map(tabGroup => {
        const filteredTabs = tabGroup.tabs.filter(tab =>
          fuzzysearch(
            filterTerm.toLowerCase(),
            `${tab.title} ${tab.url}`.toLowerCase(),
          ),
        );

        return Object.assign({}, tabGroup, { tabs: filteredTabs });
      })
      .filter(tabGroup => tabGroup.tabs.length > 0);
  };

  /** Update active tab and focused window */
  goToTab = (tabGroupId, tabId) => {
    chrome.tabs.update(tabId, { active: true });
    chrome.windows.update(tabGroupId, { focused: true });
  };

  /** Close tab */
  closeTab = (tabGroupId, tabId, event) => {
    event.stopPropagation();
    chrome.tabs.remove(tabId);

    // copy tabGroups from state
    const tabGroups = this.state.tabGroups.slice();

    // find index of tab group that contains the closed tab
    const closedTabGroupIndex = tabGroups.findIndex(
      tabGroup => tabGroup.id === tabGroupId,
    );

    // find index of closed tab within its tab group
    const closedTabIndex = tabGroups[closedTabGroupIndex].tabs.findIndex(
      tab => tab.id === tabId,
    );

    // remove closed tab from tabGroups
    tabGroups[closedTabGroupIndex].tabs.splice(closedTabIndex, 1);

    this.setState({ tabGroups });
  };

  render() {
    const tabGroups = this.filterTabGroup(
      this.sortTabGroups(this.state.tabGroups, this.state.currentTabGroupId),
      this.state.filterTerm,
    );

    return (
      <Container>
        <FilterBar
          filterTerm={this.state.filterTerm}
          onChange={this.setFilterTerm}
        />
        <TabGroups
          tabGroups={tabGroups}
          goToTab={this.goToTab}
          closeTab={this.closeTab}
        />
      </Container>
    );
  }
}

export default App;
