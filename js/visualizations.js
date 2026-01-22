/**
 * MacroRoundup Taxonomy Visualizations v2
 * Last updated: 2026-01-22 (force rebuild)
 * 
 * Provides interactive visualizations for subcluster pages:
 * - Similarity Heatmap Row
 * - Spider/Radar Chart
 * - 2D Embedding Map
 * - Interactive Network Graph
 */

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const VizUtils = {
    /**
     * Get color for heatmap based on similarity value
     * Blue (low) -> White (mid) -> Red (high)
     */
    getHeatmapColor(value) {
        // Clamp value to 0-1
        value = Math.max(0, Math.min(1, value));
        
        if (value < 0.5) {
            // Blue to white (0 to 0.5)
            const intensity = value * 2;
            const r = Math.round(255 * intensity);
            const g = Math.round(255 * intensity);
            const b = 255;
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // White to red (0.5 to 1)
            const intensity = (value - 0.5) * 2;
            const r = 255;
            const g = Math.round(255 * (1 - intensity));
            const b = Math.round(255 * (1 - intensity));
            return `rgb(${r}, ${g}, ${b})`;
        }
    },

    /**
     * Show tooltip at mouse position
     */
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
        
        // Position with bounds checking
        const x = Math.min(event.clientX + 15, window.innerWidth - 260);
        const y = Math.min(event.clientY + 15, window.innerHeight - 100);
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    },

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('viz-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    },

    /**
     * Convert text to URL-safe slug
     */
    slugify(text) {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);
    },

    /**
     * Display error message in container
     */
    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div style="color: #c00; padding: 20px; text-align: center;">
                <strong>Visualization Error</strong><br>
                <span style="font-size: 0.9em;">${message}</span>
            </div>`;
        }
    },

    /**
     * Display loading state in container
     */
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div style="color: #666; padding: 20px; text-align: center;">
                Loading visualization...
            </div>`;
        }
    }
};

// =============================================================================
// SIMILARITY HEATMAP
// =============================================================================

/**
 * Render the similarity heatmap row
 * Shows similarity to all 70 subclusters as colored cells
 */
function renderHeatmap(containerId, similarityData, currentId, colors, metadata) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Heatmap container not found:', containerId);
        return;
    }
    
    if (!similarityData || !similarityData.subclusters || !similarityData.matrix) {
        VizUtils.showError(containerId, 'Similarity data not available');
        return;
    }

    // Find current subcluster index
    const currentIdx = similarityData.subclusters.indexOf(currentId);
    if (currentIdx === -1) {
        VizUtils.showError(containerId, `Subcluster ${currentId} not found in similarity matrix`);
        return;
    }

    const simRow = similarityData.matrix[currentIdx];

    // Build heatmap HTML
    let html = '<div class="heatmap-row">';
    
    metadata.primaries.forEach((primary) => {
        primary.subclusters.forEach((sub) => {
            const idx = similarityData.subclusters.indexOf(sub.id);
            if (idx === -1) return;
            
            const sim = simRow[idx];
            const color = VizUtils.getHeatmapColor(sim);
            const isCurrent = sub.id === currentId;
            const borderStyle = isCurrent ? 'border: 2px solid #333;' : '';
            
            // Escape quotes in names for HTML attributes
            const safeName = sub.name.replace(/"/g, '&quot;');
            const safePrimary = primary.name.replace(/"/g, '&quot;');
            
            html += `<div class="heatmap-cell" 
                style="background: ${color}; ${borderStyle}"
                data-id="${sub.id}"
                data-name="${safeName}"
                data-primary="${safePrimary}"
                data-sim="${sim.toFixed(3)}"
                onclick="navigateToSubcluster('${sub.id}', '${safePrimary}')"
                onmouseenter="showHeatmapTooltip(event, '${safeName}', '${safePrimary}', ${sim.toFixed(4)})"
                onmouseleave="VizUtils.hideTooltip()"></div>`;
        });
    });
    
    html += '</div>';
    
    // Primary cluster labels
    html += '<div class="heatmap-primary-labels">';
    metadata.primaries.forEach(primary => {
        const width = (primary.subclusters.length / metadata.total_subclusters * 100).toFixed(1);
        html += `<div class="heatmap-primary-label" style="width: ${width}%; color: ${primary.color}">
            ${primary.name.substring(0, 12)}
        </div>`;
    });
    html += '</div>';
    
    // Legend
    html += `<div class="heatmap-legend">
        <span style="color: #00f;">Low (0.0)</span>
        <span style="color: #888;">Medium (0.5)</span>
        <span style="color: #f00;">High (1.0)</span>
    </div>`;
    
    container.innerHTML = html;
}

/**
 * Show tooltip for heatmap cell
 */
function showHeatmapTooltip(event, name, primary, similarity) {
    VizUtils.showTooltip(event, `
        <div class="tooltip-title">${name}</div>
        <div class="tooltip-value">
            ${primary}<br>
            Similarity: ${similarity.toFixed(3)}
        </div>
    `);
}

// =============================================================================
// SPIDER/RADAR CHART
// =============================================================================

/**
 * Render spider/radar chart showing relationship to primary clusters
 */
function renderSpiderChart(containerId, subclusterData, colors) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Spider container not found:', containerId);
        return;
    }
    
    // The spider data is in subclusterData.spider
    const spiderSimilarities = subclusterData.spider;
    if (!spiderSimilarities || Object.keys(spiderSimilarities).length === 0) {
        VizUtils.showError(containerId, 'Spider chart data not available');
        return;
    }

    // Create canvas with explicit dimensions
    const canvas = document.createElement('canvas');
    canvas.width = 450;
    canvas.height = 450;
    canvas.className = 'spider-chart';
    canvas.style.width = '450px';
    canvas.style.height = '450px';
    canvas.style.display = 'block';
    canvas.style.backgroundColor = '#fafafa';
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        VizUtils.showError(containerId, 'Could not get canvas context');
        return;
    }
    const centerX = 225;
    const centerY = 225;
    const radius = 160;

    const primaries = Object.keys(spiderSimilarities);
    const numAxes = primaries.length;
    
    if (numAxes === 0) {
        VizUtils.showError(containerId, 'No primary cluster data available');
        return;
    }
    
    const angleStep = (2 * Math.PI) / numAxes;

    // Clear canvas
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background circles (grid)
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let r = 0.2; r <= 1; r += 0.2) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * r, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Add value label
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.fillText(r.toFixed(1), centerX + 5, centerY - radius * r + 3);
    }

    // Draw axes and labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    primaries.forEach((name, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Draw axis line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw label
        const labelRadius = radius + 35;
        const labelX = centerX + Math.cos(angle) * labelRadius;
        const labelY = centerY + Math.sin(angle) * labelRadius;
        
        ctx.fillStyle = '#444';
        ctx.font = '9px sans-serif';
        
        // Truncate long names
        const displayName = name.length > 15 ? name.substring(0, 14) + '...' : name;
        ctx.fillText(displayName, labelX, labelY);
    });

    // Draw data polygon
    ctx.beginPath();
    primaries.forEach((name, i) => {
        const value = spiderSimilarities[name] || 0;
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(52, 152, 219, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points
    primaries.forEach((name, i) => {
        const value = spiderSimilarities[name] || 0;
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#2980b9';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Add title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Average Similarity to Primary Clusters', centerX, 30);
}

// =============================================================================
// 2D EMBEDDING MAP
// =============================================================================

/**
 * Render 2D t-SNE embedding map
 */
function renderEmbeddingMap(containerId, coords, currentId, colors) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Embedding map container not found:', containerId);
        return;
    }
    
    if (!coords || coords.length === 0) {
        VizUtils.showError(containerId, 'Coordinate data not available');
        return;
    }

    let html = '';
    
    // Create legend
    const primariesSeen = new Map();
    coords.forEach(point => {
        if (!primariesSeen.has(point.primary_name)) {
            const color = (colors && colors.by_name && colors.by_name[point.primary_name]) || '#999';
            primariesSeen.set(point.primary_name, color);
        }
    });
    
    html += '<div class="map-legend">';
    primariesSeen.forEach((color, name) => {
        html += `<div class="map-legend-item">
            <div class="map-legend-color" style="background: ${color}"></div>
            <span>${name.substring(0, 18)}</span>
        </div>`;
    });
    html += '</div>';
    
    // Create points
    let pointCount = 0;
    coords.forEach(point => {
        const color = (colors && colors.by_name && colors.by_name[point.primary_name]) || '#999';
        const isCurrent = point.id === currentId;
        const className = isCurrent ? 'map-point current' : 'map-point';
        
        // Ensure coordinates are in valid percentage range (5-95%)
        const x = Math.max(5, Math.min(95, 5 + point.x * 0.9));
        const y = Math.max(5, Math.min(95, 5 + point.y * 0.9));
        
        const safeName = point.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safePrimary = point.primary_name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        html += `<div class="${className}" 
            style="left: ${x}%; top: ${y}%; background-color: ${color};"
            onclick="navigateToSubcluster('${point.id}', '${safePrimary}')"
            onmouseenter="showMapTooltip(event, '${safeName}', '${safePrimary}', ${point.article_count})"
            onmouseleave="VizUtils.hideTooltip()">
        </div>`;
        pointCount++;
    });
    
    console.log(`Embedding map: rendered ${pointCount} points`);
    container.innerHTML = html;
}

/**
 * Show tooltip for map point
 */
function showMapTooltip(event, name, primary, articleCount) {
    VizUtils.showTooltip(event, `
        <div class="tooltip-title">${name}</div>
        <div class="tooltip-value">
            ${primary}<br>
            ${articleCount} articles
        </div>
    `);
}

// =============================================================================
// NETWORK GRAPH
// =============================================================================

/**
 * Render interactive network graph
 */
function renderNetworkGraph(containerId, subclusterData, coords, colors, threshold) {
    threshold = threshold || 0.3;
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Network graph container not found:', containerId);
        return;
    }
    
    if (!subclusterData || !subclusterData.related) {
        VizUtils.showError(containerId, 'Network data not available');
        return;
    }

    // Use fixed dimensions for consistent rendering
    const width = 800;
    const height = 550;
    const centerX = width / 2;
    const centerY = height / 2;

    // Filter connections above threshold
    const connections = subclusterData.related
        .filter(r => r.similarity >= threshold)
        .slice(0, 25);
    
    if (connections.length === 0) {
        container.innerHTML = `
            <div class="network-controls">
                <label>Similarity threshold: <span id="threshold-value">${threshold.toFixed(2)}</span></label>
                <input type="range" min="0.1" max="0.7" step="0.05" value="${threshold}" 
                    onchange="updateNetworkThreshold(this.value)">
            </div>
            <div style="text-align: center; padding: 40px; color: #666;">
                No connections above threshold ${threshold.toFixed(2)}.<br>
                Try lowering the threshold.
            </div>
        `;
        return;
    }

    const radius = Math.min(width, height) * 0.35;
    const angleStep = (2 * Math.PI) / connections.length;

    // Build SVG with viewBox for responsiveness
    let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="display: block; width: 100%; height: auto; min-height: 500px; background: #fafafa; border-radius: 8px;">`;
    
    // Draw edges first (so nodes appear on top)
    connections.forEach((conn, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const strokeWidth = 1 + conn.similarity * 5;
        const opacity = 0.2 + conn.similarity * 0.6;
        
        svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" 
            stroke="#666" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
    });
    
    // Draw center node (current subcluster)
    svg += `<circle cx="${centerX}" cy="${centerY}" r="22" fill="#E63946" stroke="#fff" stroke-width="3"/>`;
    
    // Center node label (below node)
    const centerLabel = subclusterData.name.substring(0, 22);
    svg += `<text x="${centerX}" y="${centerY + 38}" text-anchor="middle" 
        font-size="11" font-weight="bold" fill="#333">${centerLabel}</text>`;
    svg += `<text x="${centerX}" y="${centerY + 50}" text-anchor="middle" 
        font-size="9" fill="#666">(current)</text>`;
    
    // Draw connected nodes
    connections.forEach((conn, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const color = (colors && colors.by_name && colors.by_name[conn.primary_name]) || '#999';
        const nodeRadius = 10 + conn.similarity * 10;
        
        // Node circle
        svg += `<circle cx="${x}" cy="${y}" r="${nodeRadius}" fill="${color}" stroke="#fff" stroke-width="2" 
            style="cursor: pointer;" 
            onclick="navigateToSubcluster('${conn.id}', '${conn.primary_name.replace(/'/g, "\\'")}')"/>`;
        
        // Labels
        const labelY = y + nodeRadius + 14;
        const label = conn.name.substring(0, 16);
        svg += `<text x="${x}" y="${labelY}" text-anchor="middle" font-size="9" fill="#444">${label}</text>`;
        svg += `<text x="${x}" y="${labelY + 11}" text-anchor="middle" font-size="8" fill="#888">(${conn.similarity.toFixed(2)})</text>`;
    });
    
    svg += '</svg>';
    
    // Controls
    let html = `
        <div class="network-controls">
            <label>Similarity threshold: <span id="threshold-value">${threshold.toFixed(2)}</span></label>
            <input type="range" min="0.1" max="0.7" step="0.05" value="${threshold}" 
                onchange="updateNetworkThreshold(this.value)">
            <span style="font-size: 0.8em; color: #888; margin-left: 10px;">${connections.length} connections</span>
        </div>
    `;
    
    container.innerHTML = html + svg;
}

/**
 * Update network graph with new threshold
 */
function updateNetworkThreshold(threshold) {
    const thresholdDisplay = document.getElementById('threshold-value');
    if (thresholdDisplay) {
        thresholdDisplay.textContent = parseFloat(threshold).toFixed(2);
    }
    
    if (window.vizData && window.vizData.subclusterData && window.vizData.coords && window.vizData.colors) {
        renderNetworkGraph(
            'network-graph', 
            window.vizData.subclusterData, 
            window.vizData.coords, 
            window.vizData.colors, 
            parseFloat(threshold)
        );
    }
}

// =============================================================================
// NAVIGATION
// =============================================================================

/**
 * Navigate to a subcluster page
 */
function navigateToSubcluster(id, primaryName) {
    if (!window.vizData || !window.vizData.coords) {
        console.error('Navigation data not available');
        return;
    }
    
    // Find the subcluster in coords to get its name
    const subcluster = window.vizData.coords.find(c => c.id === id);
    if (!subcluster) {
        console.error('Subcluster not found:', id);
        return;
    }
    
    const primarySlug = VizUtils.slugify(primaryName);
    const subSlug = VizUtils.slugify(subcluster.name);
    
    // Construct URL (go up two levels from current page)
    const url = `../../clusters/${primarySlug}/${subSlug}.html`;
    window.location.href = url;
}

// =============================================================================
// COLLAPSIBLE SECTIONS
// =============================================================================

/**
 * Toggle collapsible section
 */
function toggleCollapsible(header) {
    header.classList.toggle('collapsed');
    const content = header.nextElementSibling;
    if (content) {
        content.classList.toggle('collapsed');
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Global data store for visualizations
 */
window.vizData = {
    similarity: null,
    coords: null,
    colors: null,
    metadata: null,
    subclusterData: null
};

/**
 * Initialize all visualizations when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== MacroRoundup Visualizations v4 STARTING ===');
    
    // IMMEDIATE visible test - if you see this, JS is running
    const testBanner = document.createElement('div');
    testBanner.id = 'js-test-banner';
    testBanner.style.cssText = 'background: #0a0; color: white; padding: 15px; text-align: center; font-weight: bold; font-size: 16px; position: fixed; top: 0; left: 0; right: 0; z-index: 99999;';
    testBanner.textContent = 'JS VERSION 4 LOADED - ' + new Date().toISOString();
    document.body.insertBefore(testBanner, document.body.firstChild);
    
    // Get subcluster ID from body data attribute
    const subclusterId = document.body.dataset.subclusterId;
    console.log('Subcluster ID:', subclusterId);
    
    if (!subclusterId) {
        console.log('No subcluster ID found - not a subcluster page');
        testBanner.textContent += ' | Not a subcluster page';
        testBanner.style.background = '#f80';
        return;
    }
    
    testBanner.textContent += ' | Loading ' + subclusterId;
    
    // Show loading states with very visible styling
    const vizContainers = ['heatmap-viz', 'spider-viz', 'embedding-map', 'network-graph'];
    vizContainers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: white; background: #36c; font-weight: bold; font-size: 18px; border: 4px solid #08f;">LOADING: ' + id + '</div>';
            console.log('Set loading state for:', id);
        } else {
            console.error('Container NOT FOUND:', id);
        }
    });
    
    // Determine correct base URL based on page location
    // Pages are at /clusters/primary-slug/subcluster-slug.html
    // Data is at /data/
    const baseUrl = '../../data/';
    
    console.log('Fetching data from:', baseUrl);
    
    // Fetch all required data with detailed error handling
    const fetchWithLogging = async (url, name) => {
        console.log(`Fetching ${name} from ${url}...`);
        try {
            const response = await fetch(url);
            console.log(`${name}: HTTP ${response.status} ${response.statusText}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${name}`);
            }
            const data = await response.json();
            console.log(`${name}: Loaded successfully, type=${typeof data}, keys=${Object.keys(data).slice(0,5).join(',')}`);
            return data;
        } catch (err) {
            console.error(`${name}: Failed to load -`, err);
            throw new Error(`${name}: ${err.message}`);
        }
    };
    
    Promise.all([
        fetchWithLogging(baseUrl + 'similarity_matrix.json', 'similarity_matrix'),
        fetchWithLogging(baseUrl + 'coords_2d.json', 'coords_2d'),
        fetchWithLogging(baseUrl + 'colors.json', 'colors'),
        fetchWithLogging(baseUrl + 'metadata.json', 'metadata'),
        fetchWithLogging(baseUrl + 'subclusters/' + subclusterId + '.json', 'subcluster_data')
    ])
    .then(([similarity, coords, colors, metadata, subclusterData]) => {
        console.log('All data loaded successfully');
        console.log('- Similarity matrix subclusters:', similarity.subclusters?.length);
        console.log('- Coords entries:', coords?.length);
        console.log('- Colors keys:', Object.keys(colors || {}).join(','));
        console.log('- Metadata primaries:', metadata.primaries?.length);
        console.log('- Subcluster spider keys:', Object.keys(subclusterData.spider || {}).length);
        
        // Store data globally for interactions
        window.vizData = {
            similarity: similarity,
            coords: coords,
            colors: colors,
            metadata: metadata,
            subclusterData: subclusterData
        };
        
        // Render all visualizations with try-catch
        try {
            console.log('Rendering heatmap...');
            renderHeatmap('heatmap-viz', similarity, subclusterId, colors, metadata);
            console.log('Heatmap rendered');
        } catch (e) {
            console.error('Heatmap render error:', e);
            VizUtils.showError('heatmap-viz', 'Render error: ' + e.message);
        }
        
        try {
            console.log('Rendering spider chart...');
            renderSpiderChart('spider-viz', subclusterData, colors);
            console.log('Spider chart rendered');
        } catch (e) {
            console.error('Spider chart render error:', e);
            VizUtils.showError('spider-viz', 'Render error: ' + e.message);
        }
        
        try {
            console.log('Rendering embedding map...');
            renderEmbeddingMap('embedding-map', coords, subclusterId, colors);
            console.log('Embedding map rendered');
        } catch (e) {
            console.error('Embedding map render error:', e);
            VizUtils.showError('embedding-map', 'Render error: ' + e.message);
        }
        
        try {
            console.log('Rendering network graph...');
            renderNetworkGraph('network-graph', subclusterData, coords, colors, 0.3);
            console.log('Network graph rendered');
        } catch (e) {
            console.error('Network graph render error:', e);
            VizUtils.showError('network-graph', 'Render error: ' + e.message);
        }
        
        console.log('=== ALL VISUALIZATION RENDERING COMPLETE ===');
        
        // Update banner to show success
        const banner = document.getElementById('js-test-banner');
        if (banner) {
            banner.textContent = 'VIZ v4 COMPLETE - All rendered successfully!';
            banner.style.background = '#060';
        }
    })
    .catch(error => {
        console.error('=== FETCH ERROR ===', error);
        
        // Update banner to show error
        const banner = document.getElementById('js-test-banner');
        if (banner) {
            banner.textContent = 'VIZ v4 ERROR: ' + error.message;
            banner.style.background = '#c00';
        }
        
        // Show error in all containers with detailed message
        vizContainers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `<div style="color: white; padding: 30px; text-align: center; background: #c00; border-radius: 8px; font-size: 16px;">
                    <strong>FAILED TO LOAD: ${id}</strong><br>
                    <span>${error.message}</span><br>
                    <span style="font-size: 0.8em;">Check browser console (F12)</span>
                </div>`;
            }
        });
    });
});

// Signal that script loaded
console.log('MacroRoundup Visualizations script loaded');
