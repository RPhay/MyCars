(function () {
  const tree = document.getElementById('dealershipTree');
  if (!tree) return;

  const tbody = tree.querySelector('tbody');
  const stateRows = tbody.querySelectorAll('.state-row');
  const cityRows = tbody.querySelectorAll('.city-row');
  const dealershipRows = tbody.querySelectorAll('.dealership-row');
  const searchInput = document.getElementById('dealershipSearch');

  const expandedStates = new Set();

  // Handle state row expansion
  stateRows.forEach((stateRow) => {
    const state = stateRow.dataset.state;
    const chevron = stateRow.querySelector('.chevron-toggle');

    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleState(state);
    });

    stateRow.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        toggleState(state);
      }
    });
  });

  function toggleState(state) {
    if (expandedStates.has(state)) {
      expandedStates.delete(state);
      collapseState(state);
    } else {
      expandedStates.add(state);
      expandState(state);
    }
  }

  function expandState(state) {
    const stateRow = tbody.querySelector(`.state-row[data-state="${state}"]`);
    const chevron = stateRow.querySelector('.chevron-toggle i');
    chevron.className = 'bi bi-chevron-down';

    // Show city rows for this state
    const citiesForState = tbody.querySelectorAll(`.city-row[data-state="${state}"]`);
    citiesForState.forEach((cityRow) => {
      cityRow.style.display = '';
    });

    // Show dealerships if their city is expanded
    const dealershipsForState = tbody.querySelectorAll(`.dealership-row[data-state="${state}"]`);
    dealershipsForState.forEach((row) => {
      const city = row.dataset.city;
      const cityRow = tbody.querySelector(`.city-row[data-city="${city}"][data-state="${state}"]`);
      const isCityExpanded = cityRow.style.display !== 'none' && hasExpandedCityClass(cityRow);
      if (isCityExpanded) {
        row.style.display = '';
      }
    });
  }

  function collapseState(state) {
    const stateRow = tbody.querySelector(`.state-row[data-state="${state}"]`);
    const chevron = stateRow.querySelector('.chevron-toggle i');
    chevron.className = 'bi bi-chevron-right';

    // Hide all related rows
    const citiesForState = tbody.querySelectorAll(`.city-row[data-state="${state}"]`);
    citiesForState.forEach((cityRow) => {
      cityRow.style.display = 'none';
      cityRow.classList.remove('expanded');
    });

    const dealershipsForState = tbody.querySelectorAll(`.dealership-row[data-state="${state}"]`);
    dealershipsForState.forEach((row) => {
      row.style.display = 'none';
    });
  }

  function hasExpandedCityClass(cityRow) {
    return cityRow.classList.contains('expanded');
  }

  // Handle city row clicks
  cityRows.forEach((cityRow) => {
    cityRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const state = cityRow.dataset.state;
      const city = cityRow.dataset.city;
      toggleCity(state, city);
    });
  });

  function toggleCity(state, city) {
    const cityRow = tbody.querySelector(`.city-row[data-city="${city}"][data-state="${state}"]`);
    const dealershipsForCity = tbody.querySelectorAll(
      `.dealership-row[data-state="${state}"][data-city="${city}"]`
    );

    if (cityRow.classList.contains('expanded')) {
      cityRow.classList.remove('expanded');
      dealershipsForCity.forEach((row) => {
        row.style.display = 'none';
      });
    } else {
      cityRow.classList.add('expanded');
      dealershipsForCity.forEach((row) => {
        row.style.display = '';
      });
    }
  }

  // Handle dealership row navigation
  dealershipRows.forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      const href = row.dataset.href;
      if (href) window.location.href = href;
    });
  });

  // Handle search
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
      // Reset to collapsed state
      expandedStates.clear();
      stateRows.forEach((row) => collapseState(row.dataset.state));
      cityRows.forEach((row) => row.classList.remove('expanded'));
      dealershipRows.forEach((row) => {
        row.style.display = 'none';
      });
      document.getElementById('dealershipEmptyState').style.display = 'none';
      return;
    }

    // Filter and show matching dealerships
    let visibleCount = 0;
    dealershipRows.forEach((row) => {
      const searchBlob = row.dataset.search;
      const matches = searchBlob.includes(query);

      if (matches) {
        visibleCount++;
        row.style.display = '';
        const state = row.dataset.state;
        const city = row.dataset.city;

        // Auto-expand state and city
        expandedStates.add(state);
        const stateRow = tbody.querySelector(`.state-row[data-state="${state}"]`);
        const chevron = stateRow.querySelector('.chevron-toggle i');
        chevron.className = 'bi bi-chevron-down';

        const cityRow = tbody.querySelector(`.city-row[data-city="${city}"][data-state="${state}"]`);
        cityRow.style.display = '';
        cityRow.classList.add('expanded');
      } else {
        row.style.display = 'none';
      }
    });

    // Show/hide city rows based on visible dealerships
    cityRows.forEach((cityRow) => {
      const state = cityRow.dataset.state;
      const city = cityRow.dataset.city;
      const visibleInCity = Array.from(
        tbody.querySelectorAll(
          `.dealership-row[data-state="${state}"][data-city="${city}"]`
        )
      ).some((row) => row.style.display !== 'none');

      if (visibleInCity) {
        cityRow.style.display = '';
      } else {
        cityRow.style.display = 'none';
      }
    });

    // Show/hide state rows based on visible cities
    stateRows.forEach((stateRow) => {
      const state = stateRow.dataset.state;
      const visibleInState = Array.from(
        tbody.querySelectorAll(`.city-row[data-state="${state}"]`)
      ).some((row) => row.style.display !== 'none');

      if (visibleInState) {
        stateRow.style.display = '';
      } else {
        stateRow.style.display = 'none';
      }
    });

    document.getElementById('dealershipEmptyState').style.display =
      visibleCount === 0 ? '' : 'none';
  });
})();
