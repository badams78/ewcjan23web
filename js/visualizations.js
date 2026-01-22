
// Visualization utilities
const VizUtils = {
    // Color interpolation for heatmap
    getHeatmapColor(value) {
        // Blue (low) -> White (mid) -> Red (high)
        const r = value > 0.5 ? 255 : Math.round(255 * value * 2);
        const b = value < 0.5 ? 255 : Math.round(255 * (1 - value) * 2);
        const g = value < 0.5 ? Math.round(255 * value * 2) : Math.round(255 * (1 - value) * 2);
        return `rgb(${r}, ${g}, ${b})`;
    },

    // Tooltip management
    showTooltip(event, content) {
        let tooltip = document.getElementById('viz-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'viz-tooltip';
            tooltip.className = 'tooltip';
            document.body.appendChild(tooltip);
        }
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        tooltip.style.left = (event.clientX + 15) + 'px';
        tooltip.style.top = (event.clientY + 15) + 'px';
    },

    hideTooltip() {
        const tooltip = document.getElementById('viz-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    },

    // Slugify for URLs
    slugify(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .substring(0, 50);
    }
};

// Heatmap Row Visualization
function renderHeatmap(containerId, data, currentId, colors, metadata) {
    const container = document.getElementById(containerId);
    if (!container || !data) return;

    // Find current index
    const currentIdx = data.subclusters.indexOf(currentId);
    if (currentIdx === -1) return;

    const simRow = data.matrix[currentIdx];

    // Build heatmap HTML
    let html = '<div class="heatmap-row">';
    
    // Group by primary
    let currentPrimary = null;
    metadata.primaries.forEach((primary, pIdx) => {
        primary.subclusters.forEach((sub, sIdx) => {
            const idx = data.subclusters.indexOf(sub.id);
            const sim = simRow[idx];
            const color = VizUtils.getHeatmapColor(sim);
            const isCurrent = sub.id === currentId;
            
            html += `<div class="heatmap-cell" 
                style="background: ${color}; ${isCurrent ? 'border: 2px solid #333;' : ''}"
                data-id="${sub.id}"
                data-name="${sub.name}"
                data-primary="${primary.name}"
                data-sim="${sim.toFixed(3)}"
                onclick="navigateToSubcluster('${sub.id}', '${primary.name}')"
                onmouseover="VizUtils.showTooltip(event, '<div class=tooltip-title>${sub.name}</div><div class=tooltip-value>${primary.name}<br>Similarity: ${sim.toFixed(3)}</div>')"
                onmouseout="VizUtils.hideTooltip()"></div>`;
        });
    });
    
    html += '</div>';
    
    // Primary labels
    html += '<div class="heatmap-primary-labels">';
    metadata.primaries.forEach(primary => {
        const width = (primary.subclusters.length / 70 * 100).toFixed(1);
        html += `<div class="heatmap-primary-label" style="width: ${width}%; color: ${primary.color}">${primary.name.substring(0, 15)}</div>`;
    });
    html += '</div>';
    
    html += '<div class="heatmap-legend"><span>Low similarity (0.0)</span><span>High similarity (1.0)</span></div>';
    
    container.innerHTML = html;
}

// Spider/Radar Chart using Canvas
function renderSpiderChart(containerId, spiderData, colors) {
    const container = document.getElementById(containerId);
    if (!container || !spiderData) return;

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    canvas.className = 'spider-chart';
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const centerX = 200;
    const centerY = 200;
    const radius = 150;

    const primaries = Object.keys(spiderData.similarities);
    const numAxes = primaries.length;
    const angleStep = (2 * Math.PI) / numAxes;

    // Draw background circles
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let r = 0.2; r <= 1; r += 0.2) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * r, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // Draw axes and labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    primaries.forEach((name, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#ccc';
        ctx.stroke();
        
        // Label
        const labelX = centerX + Math.cos(angle) * (radius + 20);
        const labelY = centerY + Math.sin(angle) * (radius + 20);
        ctx.fillText(name.substring(0, 12), labelX, labelY);
    });

    // Draw data polygon
    ctx.beginPath();
    primaries.forEach((name, i) => {
        const value = spiderData.similarities[name];
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw data points
    primaries.forEach((name, i) => {
        const value = spiderData.similarities[name];
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#3498db';
        ctx.fill();
    });
}

// 2D Embedding Map
function renderEmbeddingMap(containerId, coords, currentId, colors) {
    const container = document.getElementById(containerId);
    if (!container || !coords) return;

    let html = '';
    
    // Create legend
    const primariesSeen = new Set();
    html += '<div class="map-legend">';
    coords.forEach(point => {
        if (!primariesSeen.has(point.primary_name)) {
            primariesSeen.add(point.primary_name);
            const color = colors.by_name[point.primary_name] || '#999';
            html += `<div class="map-legend-item"><div class="map-legend-color" style="background: ${color}"></div>${point.primary_name.substring(0, 20)}</div>`;
        }
    });
    html += '</div>';
    
    // Create points
    coords.forEach(point => {
        const color = colors.by_name[point.primary_name] || '#999';
        const isCurrent = point.id === currentId;
        html += `<div class="map-point ${isCurrent ? 'current' : ''}" 
            style="left: ${point.x}%; top: ${point.y}%; background: ${color};"
            onclick="navigateToSubcluster('${point.id}', '${point.primary_name}')"
            onmouseover="VizUtils.showTooltip(event, '<div class=tooltip-title>${point.name}</div><div class=tooltip-value>${point.primary_name}<br>${point.article_count} articles</div>')"
            onmouseout="VizUtils.hideTooltip()"></div>`;
    });
    
    container.innerHTML = html;
}

// Network Graph using D3-force (simplified version without D3)
function renderNetworkGraph(containerId, subclusterData, allCoords, colors, threshold = 0.3) {
    const container = document.getElementById(containerId);
    if (!container || !subclusterData) return;

    const width = container.clientWidth || 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Filter to connections above threshold
    const connections = subclusterData.related.filter(r => r.similarity >= threshold).slice(0, 30);
    
    // Position nodes in a circle around center
    const angleStep = (2 * Math.PI) / connections.length;
    const radius = Math.min(width, height) * 0.35;

    let svg = `<svg width="${width}" height="${height}" style="display: block;">`;
    
    // Draw edges
    connections.forEach((conn, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const strokeWidth = 1 + conn.similarity * 4;
        const opacity = 0.3 + conn.similarity * 0.5;
        
        svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" 
            stroke="#999" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
    });
    
    // Draw center node (current)
    svg += `<circle cx="${centerX}" cy="${centerY}" r="20" fill="#E63946" stroke="#333" stroke-width="3"/>`;
    svg += `<text x="${centerX}" y="${centerY + 35}" text-anchor="middle" font-size="11" fill="#333">${subclusterData.name.substring(0, 20)}</text>`;
    
    // Draw connected nodes
    connections.forEach((conn, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const color = colors.by_name[conn.primary_name] || '#999';
        const nodeRadius = 8 + conn.similarity * 8;
        
        svg += `<circle cx="${x}" cy="${y}" r="${nodeRadius}" fill="${color}" stroke="white" stroke-width="2" 
            style="cursor: pointer;" 
            onclick="navigateToSubcluster('${conn.id}', '${conn.primary_name}')"/>`;
        
        // Label
        const labelY = y + nodeRadius + 12;
        svg += `<text x="${x}" y="${labelY}" text-anchor="middle" font-size="9" fill="#666">${conn.name.substring(0, 15)}</text>`;
        svg += `<text x="${x}" y="${labelY + 10}" text-anchor="middle" font-size="8" fill="#999">(${conn.similarity.toFixed(2)})</text>`;
    });
    
    svg += '</svg>';
    
    // Controls
    let html = `
        <div class="network-controls">
            <label>Similarity threshold: <span id="threshold-value">${threshold.toFixed(2)}</span></label>
            <input type="range" min="0.1" max="0.7" step="0.05" value="${threshold}" 
                onchange="updateNetworkThreshold(this.value)">
        </div>
    `;
    
    container.innerHTML = html + svg;
}

// Update network with new threshold
function updateNetworkThreshold(threshold) {
    document.getElementById('threshold-value').textContent = parseFloat(threshold).toFixed(2);
    if (window.currentSubclusterData && window.allCoords && window.colorsData) {
        renderNetworkGraph('network-graph', window.currentSubclusterData, window.allCoords, window.colorsData, parseFloat(threshold));
    }
}

// Navigate to subcluster page
function navigateToSubcluster(id, primaryName) {
    const primarySlug = VizUtils.slugify(primaryName);
    // Extract subcluster name from data if available
    const subName = window.allCoords?.find(c => c.id === id)?.name || id;
    const subSlug = VizUtils.slugify(subName);
    window.location.href = `../../clusters/${primarySlug}/${subSlug}.html`;
}

// Collapsible sections
function toggleCollapsible(header) {
    header.classList.toggle('collapsed');
    const content = header.nextElementSibling;
    content.classList.toggle('collapsed');
}

// Initialize visualizations on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load data and render if elements exist
    const subclusterId = document.body.dataset.subclusterId;
    if (!subclusterId) return;

    // Fetch data files
    Promise.all([
        fetch('../../data/similarity_matrix.json').then(r => r.json()),
        fetch('../../data/coords_2d.json').then(r => r.json()),
        fetch('../../data/colors.json').then(r => r.json()),
        fetch('../../data/metadata.json').then(r => r.json()),
        fetch(`../../data/subclusters/${subclusterId}.json`).then(r => r.json())
    ]).then(([similarity, coords, colors, metadata, subclusterData]) => {
        // Store globally for threshold updates
        window.currentSubclusterData = subclusterData;
        window.allCoords = coords;
        window.colorsData = colors;

        // Render visualizations
        renderHeatmap('heatmap-viz', similarity, subclusterId, colors, metadata);
        renderSpiderChart('spider-viz', subclusterData, colors);
        renderEmbeddingMap('embedding-map', coords, subclusterId, colors);
        renderNetworkGraph('network-graph', subclusterData, coords, colors, 0.3);
    }).catch(err => {
        console.error('Error loading visualization data:', err);
    });
});
