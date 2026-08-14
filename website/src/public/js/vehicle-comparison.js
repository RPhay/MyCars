/**
 * Vehicle Comparison Table Renderer
 * Generates sortable table with special categories, red flags, and hover tooltips
 */

class VehicleComparison {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.data = null;
    this.sortColumn = 'adjustedScore';
    this.sortDirection = 'desc';
  }

  async loadComparison(scope) {
    try {
      const response = await fetch(`/api/compare?scope=${encodeURIComponent(scope)}&isLocal=true`);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      this.data = await response.json();
      this.render();
    } catch (error) {
      this.container.innerHTML = `<div class="alert alert-danger">Failed to load comparison: ${error.message}</div>`;
    }
  }

  render() {
    if (!this.data || this.data.error) {
      this.container.innerHTML = `<div class="alert alert-warning">${this.data?.error || 'No comparison data'}</div>`;
      return;
    }

    // Render summary
    const summary = this.renderSummary();

    // Render special categories
    const categories = this.renderSpecialCategories();

    // Render table
    const table = this.renderTable();

    this.container.innerHTML = summary + categories + table;

    // Add event listeners
    this.attachEventListeners();
  }

  renderSummary() {
    const { summary, vehicleCount } = this.data;
    return `
      <div class="comparison-summary card mb-4">
        <div class="card-body">
          <h5 class="card-title">Comparison Summary</h5>
          <div class="row">
            <div class="col-md-2"><strong>Vehicles:</strong> ${vehicleCount}</div>
            <div class="col-md-2"><strong>Price:</strong> $${summary.priceRange.min.toLocaleString()} – $${summary.priceRange.max.toLocaleString()}</div>
            <div class="col-md-2"><strong>Mileage:</strong> ${summary.mileageRange.min.toLocaleString()} – ${summary.mileageRange.max.toLocaleString()} mi</div>
            <div class="col-md-2"><strong>Local:</strong> ${summary.localCount}</div>
            <div class="col-md-2"><strong>Delivery:</strong> ${summary.deliveryCount}</div>
            <div class="col-md-2"><strong>Warranty:</strong> ${summary.withWarranty} with</div>
          </div>
        </div>
      </div>
    `;
  }

  renderSpecialCategories() {
    const { ranked } = this.data;
    const categories = [
      { key: 'bestOverall', label: '🥇 Best Overall Value', icon: 'trophy' },
      { key: 'bestBudget', label: '💰 Best Budget', icon: 'piggy-bank' },
      { key: 'bestWarranty', label: '🛡️ Best Warranty', icon: 'shield-check' },
      { key: 'bestCondition', label: '✨ Best Condition', icon: 'star' },
      { key: 'bestLocal', label: '🎯 Best Local', icon: 'geo-alt' },
    ];

    let html = '<div class="special-categories mb-4">';
    for (const cat of categories) {
      const vehicle = ranked.find(r => r.isSpecial[cat.key]);
      if (vehicle) {
        html += `
          <div class="category-badge badge bg-info me-2 mb-2">
            <i class="bi bi-${cat.icon}"></i> ${cat.label}:
            $${vehicle.price.toLocaleString()} · ${vehicle.mileage.toLocaleString()} mi
            (${vehicle.trim})
          </div>
        `;
      }
    }
    html += '</div>';
    return html;
  }

  renderTable() {
    const { ranked } = this.data;

    let html = `
      <div class="table-responsive">
        <table class="table table-hover table-bordered align-middle vehicle-comparison-table">
          <thead class="table-light">
            <tr>
              <th class="sortable" data-column="rank">Rank</th>
              <th class="sortable" data-column="trim">Trim</th>
              <th class="sortable" data-column="price">Price</th>
              <th class="sortable" data-column="mileage">Mileage</th>
              <th class="sortable" data-column="pricePerMile">$/1K mi</th>
              <th class="sortable" data-column="seller">Seller</th>
              <th>Local</th>
              <th class="sortable" data-column="warranty">Warranty</th>
              <th class="sortable" data-column="dealerRating">Rating</th>
              <th class="sortable" data-column="photosCount">Photos</th>
              <th class="sortable" data-column="adjustedScore">Score</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const vehicle of ranked) {
      const pricePerMile = (vehicle.price / (vehicle.mileage / 1000)).toFixed(0);
      const redFlagClass = vehicle.redFlags.length > 0 ? 'table-warning' : '';
      const bestClass = vehicle.isSpecial.bestOverall ? 'table-success' : '';
      const rowClass = bestClass || redFlagClass;

      html += `
        <tr class="${rowClass} vehicle-row" data-vin="${vehicle.vin}">
          <td><strong>#${vehicle.rank}</strong></td>
          <td>${vehicle.trim}</td>
          <td>$${vehicle.price.toLocaleString()}</td>
          <td>${vehicle.mileage.toLocaleString()} mi</td>
          <td>$${pricePerMile}</td>
          <td>${vehicle.seller}${vehicle.isLocal ? ' ✅' : ' 📦'}</td>
          <td>${vehicle.isLocal ? '<span class="badge bg-success">Local</span>' : '<span class="badge bg-secondary">Delivery</span>'}</td>
          <td>
            <span class="warranty-badge" title="${vehicle.warranty}">
              ${vehicle.warranty !== 'None' ? '✅' : '❌'} ${vehicle.warranty}
            </span>
          </td>
          <td>${vehicle.dealerRating.toFixed(1)}/5 ${this.renderStars(vehicle.dealerRating)}</td>
          <td>${vehicle.photosCount}</td>
          <td>
            <strong>${vehicle.adjustedScore.toFixed(0)}</strong>/100
            ${vehicle.redFlags.length > 0 ? '<br><small class="text-danger">⚠️ Flags</small>' : ''}
          </td>
          <td>${vehicle.recommendation.action}</td>
        </tr>
        ${this.renderTooltipRow(vehicle)}
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  renderTooltipRow(vehicle) {
    const { scores, redFlags, recommendation } = vehicle;

    let tooltip = `
      <div class="vehicle-tooltip" style="display: none;" data-vin="${vehicle.vin}">
        <div class="tooltip-content">
          <h6>Score Breakdown:</h6>
          <ul class="score-list">
            <li><strong>Price:</strong> ${scores.price.toFixed(0)}/100</li>
            <li><strong>Mileage:</strong> ${scores.mileage.toFixed(0)}/100</li>
            <li><strong>Warranty:</strong> ${scores.warranty.toFixed(0)}/100</li>
            <li><strong>Dealer Rating:</strong> ${scores.dealer.toFixed(0)}/100</li>
            <li><strong>Condition:</strong> ${scores.condition.toFixed(0)}/100</li>
            <li><strong>Age:</strong> ${scores.age.toFixed(0)}/100</li>
            <li><strong>Local:</strong> ${scores.local.toFixed(0)}/100</li>
            <li><strong>Value:</strong> ${scores.value.toFixed(0)}/100</li>
          </ul>

          <h6>Red Flags:</h6>
          ${redFlags.length > 0 ? `
            <ul class="flag-list">
              ${redFlags.map(f => `<li class="text-${f.severity}">${f.message}</li>`).join('')}
            </ul>
          ` : '<p class="text-success">✅ No red flags</p>'}

          <h6>Recommendation:</h6>
          <p><strong>${recommendation.action}</strong><br>${recommendation.reason}</p>

          <h6>Known Issues:</h6>
          ${vehicle.knownIssues.length > 0 ? `
            <ul>
              ${vehicle.knownIssues.map(i => `<li>${i}</li>`).join('')}
            </ul>
          ` : '<p class="text-success">None reported</p>'}
        </div>
      </div>
    `;

    return tooltip;
  }

  renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += i <= Math.round(rating) ? '★' : '☆';
    }
    return stars;
  }

  attachEventListeners() {
    // Row hover to show tooltip
    const rows = this.container.querySelectorAll('.vehicle-row');
    rows.forEach(row => {
      row.addEventListener('mouseenter', (e) => {
        const vin = row.dataset.vin;
        const tooltip = this.container.querySelector(`[data-vin="${vin}"]`);
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.position = 'absolute';
          tooltip.style.backgroundColor = '#fff';
          tooltip.style.border = '1px solid #ddd';
          tooltip.style.borderRadius = '4px';
          tooltip.style.padding = '12px';
          tooltip.style.zIndex = '1000';
          tooltip.style.maxWidth = '400px';
          tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        }
      });

      row.addEventListener('mouseleave', (e) => {
        const vin = row.dataset.vin;
        const tooltip = this.container.querySelector(`[data-vin="${vin}"]`);
        if (tooltip) {
          tooltip.style.display = 'none';
        }
      });
    });

    // Column header sorting
    const headers = this.container.querySelectorAll('th.sortable');
    headers.forEach(header => {
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        this.sortColumn = header.dataset.column;
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.sortAndRender();
      });
    });
  }

  sortAndRender() {
    const { ranked } = this.data;

    ranked.sort((a, b) => {
      let aVal, bVal;

      switch (this.sortColumn) {
        case 'rank':
          aVal = a.rank;
          bVal = b.rank;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'mileage':
          aVal = a.mileage;
          bVal = b.mileage;
          break;
        case 'pricePerMile':
          aVal = a.price / (a.mileage / 1000);
          bVal = b.price / (b.mileage / 1000);
          break;
        case 'adjustedScore':
          aVal = a.adjustedScore;
          bVal = b.adjustedScore;
          break;
        case 'warranty':
          const wOrder = { 'None': 0, '<1 year': 1, '1-2 years': 2, '2-3 years': 3, '3+ years': 4 };
          aVal = wOrder[a.warranty] || 0;
          bVal = wOrder[b.warranty] || 0;
          break;
        case 'dealerRating':
          aVal = a.dealerRating;
          bVal = b.dealerRating;
          break;
        case 'photosCount':
          aVal = a.photosCount;
          bVal = b.photosCount;
          break;
        case 'trim':
        case 'seller':
          aVal = a[this.sortColumn];
          bVal = b[this.sortColumn];
          break;
        default:
          return 0;
      }

      if (this.sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    // Re-number ranks
    ranked.forEach((v, i) => {
      v.rank = i + 1;
    });

    this.render();
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const scopeElement = document.querySelector('[data-comparison-scope]');
  if (scopeElement) {
    const scope = scopeElement.dataset.comparisonScope;
    const comparison = new VehicleComparison('comparison-table');
    comparison.loadComparison(scope);
  }
});
