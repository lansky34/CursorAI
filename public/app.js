// Add these performance monitoring utilities at the top of your file
const Performance = {
    metrics: {
        pageLoad: null,
        mapInit: null,
        markerUpdates: [],
        clusterUpdates: [],
        heatmapUpdates: [],
        interactionDelays: []
    },

    startTime: performance.now(),

    // Track page load performance
    trackPageLoad: function() {
        window.addEventListener('load', () => {
            const loadTime = performance.now() - this.startTime;
            this.metrics.pageLoad = loadTime;
            console.log(`Page load time: ${loadTime.toFixed(2)}ms`);
        });
    },

    // Track map interaction performance
    trackMapInteraction: function(action, duration) {
        this.metrics.interactionDelays.push({
            action,
            duration,
            timestamp: new Date()
        });

        // Keep only last 100 interactions
        if (this.metrics.interactionDelays.length > 100) {
            this.metrics.interactionDelays.shift();
        }
    },

    // Get performance report
    getReport: function() {
        const avgMarkerUpdate = this.metrics.markerUpdates.reduce((a, b) => a + b, 0) / 
            (this.metrics.markerUpdates.length || 1);
        const avgClusterUpdate = this.metrics.clusterUpdates.reduce((a, b) => a + b, 0) / 
            (this.metrics.clusterUpdates.length || 1);
        const avgHeatmapUpdate = this.metrics.heatmapUpdates.reduce((a, b) => a + b, 0) / 
            (this.metrics.heatmapUpdates.length || 1);

        return {
            pageLoadTime: this.metrics.pageLoad,
            mapInitTime: this.metrics.mapInit,
            averageMarkerUpdateTime: avgMarkerUpdate,
            averageClusterUpdateTime: avgClusterUpdate,
            averageHeatmapUpdateTime: avgHeatmapUpdate,
            lastInteractions: this.metrics.interactionDelays.slice(-5)
        };
    }
};

// Initialize performance tracking
Performance.trackPageLoad();

// Add throttling utility
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Add debouncing utility
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Optimize marker creation with lazy loading
function createOptimizedMarker(business) {
    const start = performance.now();
    
    // Only create detailed popup content when needed
    const marker = L.circleMarker([business.location.latitude, business.location.longitude], {
        radius: getMarkerRadius(business.visitCount),
        fillColor: getSentimentColor(business.sentimentScore),
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    });

    // Lazy load popup content
    let popup;
    marker.on('click', () => {
        if (!popup) {
            const startPopup = performance.now();
            popup = createPopupContent(business, 
                getSentimentLabel(business.sentimentScore), 
                getSentimentColor(business.sentimentScore)
            );
            Performance.trackMapInteraction('popup-creation', performance.now() - startPopup);
        }
        marker.bindPopup(popup);
        updateAspectChart(business._id);
    });

    Performance.metrics.markerUpdates.push(performance.now() - start);
    return marker;
}

// Optimize map updates
const optimizedUpdateMap = debounce(function(businesses) {
    const start = performance.now();
        
        // Clear existing layers
        markers.clearLayers();
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
        }
        
    // Batch marker creation
    const batchSize = 100;
    let currentBatch = 0;

    function processBatch() {
        const startBatch = currentBatch;
        const endBatch = Math.min(currentBatch + batchSize, businesses.length);
        
        for (let i = startBatch; i < endBatch; i++) {
            const marker = createOptimizedMarker(businesses[i]);
            markers.addLayer(marker);
        }

        currentBatch += batchSize;
        
        if (currentBatch < businesses.length) {
            requestAnimationFrame(processBatch);
            } else {
            // Update heatmap after all markers are added
            updateHeatmap(businesses);
        }
    }

    processBatch();
    Performance.trackMapInteraction('map-update', performance.now() - start);
}, 100);

// Optimize heatmap updates
function updateHeatmap(businesses) {
    const start = performance.now();
    
    const heatmapData = businesses.map(business => [
        business.location.latitude,
        business.location.longitude,
        Math.min(business.visitCount / 100, 1)
    ]);

        heatmapLayer = L.heatLayer(heatmapData, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {
                0.4: 'blue',
                0.6: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            }
        });

    if (document.getElementById('heatmap-toggle').checked) {
        map.addLayer(heatmapLayer);
    }

    Performance.metrics.heatmapUpdates.push(performance.now() - start);
}

// Optimize cluster updates
markers.on('clustermouseover', throttle(function(event) {
    const start = performance.now();
    const cluster = event.layer;
    const childMarkers = cluster.getAllChildMarkers();
    
    // Pre-calculate cluster statistics
    const clusterStats = childMarkers.reduce((stats, marker) => {
        const business = marker.business;
        stats.avgSentiment += business.sentimentScore;
        stats.totalVisits += business.visitCount;
        return stats;
    }, { avgSentiment: 0, totalVisits: 0 });

    clusterStats.avgSentiment /= childMarkers.length;

    // Update cluster appearance based on statistics
    cluster.setStyle({
        fillColor: getSentimentColor(clusterStats.avgSentiment)
    });

    Performance.metrics.clusterUpdates.push(performance.now() - start);
}, 100));

// Add viewport-based marker loading
map.on('moveend', debounce(() => {
    const bounds = map.getBounds();
    const visibleBusinesses = allBusinesses.filter(business => 
        bounds.contains([business.location.latitude, business.location.longitude])
    );
    optimizedUpdateMap(visibleBusinesses);
}, 250));

// Monitor memory usage
setInterval(() => {
    if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        console.debug('Memory Usage:', {
            total: (memory.totalJSHeapSize / 1048576).toFixed(2) + 'MB',
            used: (memory.usedJSHeapSize / 1048576).toFixed(2) + 'MB',
            limit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + 'MB'
        });
    }
}, 30000);

// Add performance reporting command
window.getPerformanceReport = () => {
    console.table(Performance.getReport());
};

// Update the loadBusinesses function to use optimized updates
async function loadBusinesses() {
    showLoading();
    try {
        const start = performance.now();
        const response = await fetch('/api/businesses');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        allBusinesses = await response.json();
        
        if (!document.querySelector('.badge-filter')) {
            initializeBadgeFilters();
        }
        
        optimizedUpdateMap(allBusinesses);
        Performance.trackMapInteraction('initial-load', performance.now() - start);
    } catch (error) {
        console.error('Error loading businesses:', error);
        notifications.add({
            businessName: 'System Alert',
            message: 'Failed to load business data',
            severity: 'high',
            timestamp: new Date()
        });
    } finally {
        hideLoading();
    }
}

// Onboarding Tour
const OnboardingTour = {
    currentStep: 0,
    steps: [
        {
            element: '.map-controls',
            text: 'Toggle between different map views using these controls. Try switching between markers and heatmap!',
            position: 'bottom'
        },
        {
            element: '.filter-panel',
            text: 'Filter businesses by their badges. Combine multiple badges to find exactly what you\'re looking for.',
            position: 'bottom'
        },
        {
            element: '.chart-container',
            text: 'View detailed sentiment analysis for each business. Click on any marker to see its breakdown.',
            position: 'top'
        },
        {
            element: '.insights-dashboard',
            text: 'Get AI-powered insights about trending categories and personalized recommendations.',
            position: 'bottom'
        },
        {
            element: '.notification-area',
            text: 'Stay updated with real-time alerts about significant changes in business sentiment.',
            position: 'top'
        }
    ],

    init: function() {
        // Check if user has already seen the tour
        if (localStorage.getItem('onboardingComplete') === 'true') {
            return;
        }

        const overlay = document.getElementById('onboarding-overlay');
        const startButton = document.getElementById('startTour');
        const skipCheckbox = document.getElementById('skipFuture');

        overlay.classList.remove('hidden');

        startButton.addEventListener('click', () => {
            if (skipCheckbox.checked) {
                localStorage.setItem('onboardingComplete', 'true');
            }
            overlay.classList.add('hidden');
            this.start();
        });
    },

    start: function() {
        this.currentStep = 0;
        this.showTooltip();
        this.setupListeners();
    },

    setupListeners: function() {
        document.getElementById('nextStep').addEventListener('click', () => this.nextStep());
        document.getElementById('prevStep').addEventListener('click', () => this.prevStep());
    },

    showTooltip: function() {
        const step = this.steps[this.currentStep];
        const element = document.querySelector(step.element);
        const tooltip = document.getElementById('tooltip');
        const tooltipText = document.getElementById('tooltip-text');
        const stepIndicator = document.getElementById('stepIndicator');
        const prevButton = document.getElementById('prevStep');
        const nextButton = document.getElementById('nextStep');

        // Remove previous highlights
        document.querySelectorAll('.highlight').forEach(el => {
            el.classList.remove('highlight');
        });

        // Add highlight to current element
        element.classList.add('highlight');

        // Update tooltip content
        tooltipText.textContent = step.text;
        stepIndicator.textContent = `${this.currentStep + 1} of ${this.steps.length}`;
        
        // Update button states
        prevButton.disabled = this.currentStep === 0;
        nextButton.textContent = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next';

        // Position tooltip
        const elementRect = element.getBoundingClientRect();
        tooltip.setAttribute('data-position', step.position);

        const tooltipRect = tooltip.getBoundingClientRect();
        const positions = {
            top: elementRect.top - tooltipRect.height - 20,
            left: elementRect.left + (elementRect.width - tooltipRect.width) / 2
        };

        if (step.position === 'bottom') {
            positions.top = elementRect.bottom + 20;
        }

        tooltip.style.top = `${positions.top}px`;
        tooltip.style.left = `${positions.left}px`;

        tooltip.classList.remove('hidden');
    },

    nextStep: function() {
        if (this.currentStep === this.steps.length - 1) {
            this.end();
            return;
        }
        this.currentStep++;
        this.showTooltip();
    },

    prevStep: function() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showTooltip();
        }
    },

    end: function() {
        document.getElementById('tooltip').classList.add('hidden');
        document.querySelectorAll('.highlight').forEach(el => {
            el.classList.remove('highlight');
        });
    }
};

// Initialize onboarding when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    OnboardingTour.init();
});

// Smart Search Implementation
const SmartSearch = {
    recentSearches: [],
    maxRecentSearches: 5,
    suggestionCategories: {
        businesses: {
            icon: '<path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>',
            getItems: async (query) => {
                // Filter businesses by name
                return allBusinesses
                    .filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 5)
                    .map(b => ({
                        type: 'business',
                        text: b.name,
                        details: `Rating: ${(b.sentimentScore * 100).toFixed(1)}%, ${b.visitCount} visits`,
                        data: b
                    }));
            }
        },
        categories: {
            icon: '<path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm10 0h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM10 13H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10 0h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"/>',
            items: [
                'Italian Restaurants', 'Coffee Shops', 'Fast Food',
                'Fine Dining', 'Family Restaurants', 'Bars & Pubs',
                'Vegetarian & Vegan', 'Asian Cuisine', 'Food Trucks'
            ]
        },
        features: {
            icon: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/>',
            items: [
                'Top-Rated', 'Family-Friendly', 'Budget-Friendly',
                'Open Late', 'Outdoor Seating', 'Live Music',
                'Pet-Friendly', 'Wi-Fi Available', 'Parking Available'
            ]
        }
    },

    init: function() {
        this.searchInput = document.getElementById('searchInput');
        this.suggestionsContainer = document.getElementById('searchSuggestions');
        this.recentSearchesContainer = document.getElementById('recentSearches');
        
        this.loadRecentSearches();
        this.setupEventListeners();
        this.renderRecentSearches();
    },

    setupEventListeners: function() {
        // Debounced search input handler
        this.searchInput.addEventListener('input', debounce(() => {
            const query = this.searchInput.value.trim();
            if (query.length >= 2) {
                this.showSuggestions(query);
            } else {
                this.hideSuggestions();
            }
        }, 300));

        // Handle clicks outside search container
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSuggestions();
            }
        });

        // Handle suggestion selection
        this.suggestionsContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                this.handleSelection(item.dataset);
            }
        });
    },

    async showSuggestions: async function(query) {
        const suggestions = await this.getSuggestions(query);
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.suggestionsContainer.innerHTML = suggestions
            .map(suggestion => this.createSuggestionHTML(suggestion))
            .join('');
        
        this.suggestionsContainer.classList.remove('hidden');
    },

    async getSuggestions: async function(query) {
        const suggestions = [];

        // Get business suggestions
        const businessSuggestions = await this.suggestionCategories.businesses.getItems(query);
        suggestions.push(...businessSuggestions);

        // Get category suggestions
        const categoryMatches = this.suggestionCategories.categories.items
            .filter(cat => cat.toLowerCase().includes(query.toLowerCase()))
            .map(cat => ({
                type: 'category',
                text: cat,
                details: 'Category'
            }));
        suggestions.push(...categoryMatches);

        // Get feature suggestions
        const featureMatches = this.suggestionCategories.features.items
            .filter(feat => feat.toLowerCase().includes(query.toLowerCase()))
            .map(feat => ({
                type: 'feature',
                text: feat,
                details: 'Feature'
            }));
        suggestions.push(...featureMatches);

        return suggestions.slice(0, 10);
    },

    createSuggestionHTML: function(suggestion) {
        const icon = this.suggestionCategories[suggestion.type + 's']?.icon || '';
        return `
            <div class="suggestion-item" 
                 data-type="${suggestion.type}"
                 data-text="${suggestion.text}">
                <div class="suggestion-icon">
                    <svg viewBox="0 0 24 24">${icon}</svg>
                </div>
                <div class="suggestion-content">
                    <div class="suggestion-category">${suggestion.text}</div>
                    <div class="suggestion-details">${suggestion.details}</div>
                </div>
            </div>
        `;
    },

    handleSelection: function(data) {
        const { type, text } = data;
        this.searchInput.value = text;
        this.addToRecentSearches({ type, text });
        this.hideSuggestions();

        switch (type) {
            case 'business':
                // Handle business selection
                const business = allBusinesses.find(b => b.name === text);
                if (business) {
                    map.setView([business.location.latitude, business.location.longitude], 16);
                    // Find and click the corresponding marker
                    markers.getLayers().forEach(marker => {
                        if (marker.business && marker.business.name === text) {
                            marker.fire('click');
                        }
                    });
                }
                break;
            case 'category':
                // Filter businesses by category
                const categoryBusinesses = allBusinesses.filter(b => 
                    b.categories && b.categories.includes(text)
                );
                optimizedUpdateMap(categoryBusinesses);
                break;
            case 'feature':
                // Filter businesses by feature/badge
                const featureBusinesses = allBusinesses.filter(b => 
                    b.badges && b.badges.includes(text)
                );
                optimizedUpdateMap(featureBusinesses);
                break;
        }
    },

    addToRecentSearches: function(search) {
        this.recentSearches = [search, ...this.recentSearches
            .filter(s => s.text !== search.text)]
            .slice(0, this.maxRecentSearches);
        
        localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
        this.renderRecentSearches();
    },

    loadRecentSearches: function() {
        const saved = localStorage.getItem('recentSearches');
        this.recentSearches = saved ? JSON.parse(saved) : [];
    },

    renderRecentSearches: function() {
        if (this.recentSearches.length === 0) {
            this.recentSearchesContainer.innerHTML = '';
            return;
        }

        this.recentSearchesContainer.innerHTML = `
            <h4>Recent Searches</h4>
            ${this.recentSearches.map(search => `
                <span class="recent-tag" 
                      data-type="${search.type}" 
                      data-text="${search.text}">
                    ${search.text}
                </span>
            `).join('')}
        `;
    },

    hideSuggestions: function() {
        this.suggestionsContainer.classList.add('hidden');
    }
};

// Initialize smart search when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    SmartSearch.init();
});

// Nearby Places Implementation
const NearbyPlaces = {
    userLocation: null,
    preferences: {
        categories: [],
        features: [],
        radius: 1000 // meters
    },

    init: function() {
        this.loadPreferences();
        this.setupEventListeners();
    },

    loadPreferences: function() {
        const saved = localStorage.getItem('explorePreferences');
        if (saved) {
            this.preferences = JSON.parse(saved);
        }
    },

    setupEventListeners: function() {
        document.getElementById('exploreNearbyBtn').addEventListener('click', () => {
            this.findNearbyPlaces();
        });

        document.getElementById('preferencesBtn').addEventListener('click', () => {
            this.showPreferencesModal();
        });

        document.getElementById('savePreferences').addEventListener('click', () => {
            this.savePreferences();
        });

        document.getElementById('cancelPreferences').addEventListener('click', () => {
            this.hidePreferencesModal();
        });

        // Radius slider
        const radiusSlider = document.getElementById('radiusSlider');
        const radiusValue = document.getElementById('radiusValue');
        radiusSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            radiusValue.textContent = `${(value / 1000).toFixed(1)} km`;
        });
    },

    async findNearbyPlaces: function() {
        try {
            const position = await this.getCurrentPosition();
            this.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Center map on user location
            map.setView([this.userLocation.lat, this.userLocation.lng], 14);

            // Add user marker
            if (this.userMarker) {
                map.removeLayer(this.userMarker);
            }
            this.userMarker = L.circleMarker([this.userLocation.lat, this.userLocation.lng], {
                radius: 8,
                fillColor: '#3498db',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            // Find nearby businesses
            const nearbyBusinesses = this.filterNearbyBusinesses();
            this.displayNearbyResults(nearbyBusinesses);

        } catch (error) {
            console.error('Error finding nearby places:', error);
            notifications.add({
                businessName: 'Location Error',
                message: 'Could not access your location. Please enable location services.',
                severity: 'high',
                timestamp: new Date()
            });
        }
    },

    getCurrentPosition: function() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
    },

    filterNearbyBusinesses: function() {
        if (!this.userLocation) return [];

        return allBusinesses
            .map(business => {
                const distance = this.calculateDistance(
                    this.userLocation.lat,
                    this.userLocation.lng,
                    business.location.latitude,
                    business.location.longitude
                );
                return { ...business, distance };
            })
            .filter(business => {
                // Filter by distance
                if (business.distance > this.preferences.radius) return false;

                // Filter by preferences
                const matchesCategories = this.preferences.categories.length === 0 ||
                    business.categories.some(cat => this.preferences.categories.includes(cat));
                const matchesFeatures = this.preferences.features.length === 0 ||
                    business.badges.some(badge => this.preferences.features.includes(badge));

                return matchesCategories && matchesFeatures;
            })
            .sort((a, b) => {
                // Sort by match score (combination of distance and sentiment)
                const aScore = this.calculateMatchScore(a);
                const bScore = this.calculateMatchScore(b);
                return bScore - aScore;
            })
            .slice(0, 10); // Limit to top 10 results
    },

    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1000; // Convert to meters
    },

    deg2rad: function(deg) {
        return deg * (Math.PI/180);
    },

    calculateMatchScore: function(business) {
        const distanceScore = 1 - (business.distance / this.preferences.radius);
        const sentimentScore = (business.sentimentScore + 1) / 2; // Normalize to 0-1
        const popularityScore = Math.min(business.visitCount / 1000, 1);

        return (distanceScore * 0.4) + (sentimentScore * 0.4) + (popularityScore * 0.2);
    },

    displayNearbyResults: function(businesses) {
        const container = document.getElementById('nearbyResults');
        container.innerHTML = businesses.map(business => `
            <div class="nearby-item" data-id="${business._id}">
                <div class="nearby-info">
                    <strong>${business.name}</strong>
                    <div class="nearby-distance">
                        ${this.formatDistance(business.distance)}
                    </div>
                    <div class="nearby-rating" style="background: ${getSentimentColor(business.sentimentScore)}22; color: ${getSentimentColor(business.sentimentScore)}">
                        ${(business.sentimentScore * 100).toFixed(1)}% positive
                    </div>
                </div>
            </div>
        `).join('');

        container.classList.remove('hidden');

        // Add click handlers
        container.querySelectorAll('.nearby-item').forEach(item => {
            item.addEventListener('click', () => {
                const business = businesses.find(b => b._id === item.dataset.id);
                map.setView([business.location.latitude, business.location.longitude], 16);
                // Find and click the corresponding marker
                markers.getLayers().forEach(marker => {
                    if (marker.business && marker.business._id === business._id) {
                        marker.fire('click');
                    }
                });
            });
        });
    },

    formatDistance: function(meters) {
        return meters >= 1000 
            ? `${(meters/1000).toFixed(1)} km away`
            : `${Math.round(meters)} m away`;
    },

    showPreferencesModal: function() {
        const modal = document.getElementById('preferencesModal');
        
        // Populate categories
        const categoryContainer = document.getElementById('categoryPreferences');
        categoryContainer.innerHTML = this.suggestionCategories.categories.items
            .map(category => `
                <div class="preference-option ${this.preferences.categories.includes(category) ? 'selected' : ''}"
                     data-category="${category}">
                    ${category}
                </div>
            `).join('');

        // Populate features
        const featureContainer = document.getElementById('featurePreferences');
        featureContainer.innerHTML = this.suggestionCategories.features.items
            .map(feature => `
                <div class="preference-option ${this.preferences.features.includes(feature) ? 'selected' : ''}"
                     data-feature="${feature}">
                    ${feature}
                </div>
            `).join('');

        // Set radius value
        document.getElementById('radiusSlider').value = this.preferences.radius;
        document.getElementById('radiusValue').textContent = 
            `${(this.preferences.radius / 1000).toFixed(1)} km`;

        modal.classList.remove('hidden');
    },

    hidePreferencesModal: function() {
        document.getElementById('preferencesModal').classList.add('hidden');
    },

    savePreferences: function() {
        // Get selected categories
        this.preferences.categories = Array.from(
            document.querySelectorAll('#categoryPreferences .selected')
        ).map(el => el.dataset.category);

        // Get selected features
        this.preferences.features = Array.from(
            document.querySelectorAll('#featurePreferences .selected')
        ).map(el => el.dataset.feature);

        // Get radius
        this.preferences.radius = parseInt(document.getElementById('radiusSlider').value);

        // Save to localStorage
        localStorage.setItem('explorePreferences', JSON.stringify(this.preferences));

        // Update results if we have a location
        if (this.userLocation) {
            this.findNearbyPlaces();
        }

        this.hidePreferencesModal();
    }
};

// Initialize nearby places when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    NearbyPlaces.init();
});

// Business Comparison Implementation
const BusinessComparison = {
    selectedBusinesses: new Set(),
    maxSelections: 4,

    init: function() {
        this.comparisonTool = document.getElementById('comparisonTool');
        this.selectedContainer = document.getElementById('selectedBusinesses');
        this.compareButton = document.getElementById('compareButton');
        this.compareCount = document.getElementById('compareCount');
        
        this.setupEventListeners();
    },

    setupEventListeners: function() {
        document.getElementById('closeComparison').addEventListener('click', () => {
            this.comparisonTool.classList.add('hidden');
        });

        this.compareButton.addEventListener('click', () => {
            this.showComparison();
        });

        document.getElementById('closeComparisonModal').addEventListener('click', () => {
            document.getElementById('comparisonModal').classList.add('hidden');
        });
    },

    toggleBusinessSelection: function(business) {
        const businessId = business._id;
        
        if (this.selectedBusinesses.has(businessId)) {
            this.selectedBusinesses.delete(businessId);
        } else {
            if (this.selectedBusinesses.size >= this.maxSelections) {
                notifications.add({
                    businessName: 'Comparison Limit',
                    message: `You can compare up to ${this.maxSelections} businesses at once`,
                    severity: 'medium',
                    timestamp: new Date()
                });
                return;
            }
            this.selectedBusinesses.add(businessId);
        }

        this.updateUI();
    },

    updateUI: function() {
        // Show/hide comparison tool
        this.comparisonTool.classList.toggle('hidden', this.selectedBusinesses.size === 0);
        
        // Update selected businesses list
        this.selectedContainer.innerHTML = Array.from(this.selectedBusinesses)
            .map(id => {
                const business = allBusinesses.find(b => b._id === id);
                return `
                    <div class="selected-business">
                        ${business.name}
                        <button class="remove-business" data-id="${id}">×</button>
                    </div>
                `;
            })
            .join('');

        // Update compare button
        this.compareButton.disabled = this.selectedBusinesses.size < 2;
        this.compareCount.textContent = this.selectedBusinesses.size;

        // Add remove button handlers
        this.selectedContainer.querySelectorAll('.remove-business').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedBusinesses.delete(button.dataset.id);
                this.updateUI();
            });
        });
    },

    async showComparison: function() {
        const modal = document.getElementById('comparisonModal');
        const grid = document.getElementById('comparisonGrid');
        const aiAnalysis = document.getElementById('aiAnalysis');

        // Show loading state
        grid.innerHTML = '<div class="loading-spinner"></div>';
        modal.classList.remove('hidden');

        try {
            const businesses = Array.from(this.selectedBusinesses)
                .map(id => allBusinesses.find(b => b._id === id));

            // Generate comparison grid
            grid.innerHTML = businesses.map(business => `
                <div class="comparison-column">
                    <div class="comparison-item">
                        <h4>${business.name}</h4>
                        <div class="metric-row">
                            <span class="metric-label">Overall Sentiment</span>
                            <span class="metric-value">${(business.sentimentScore * 100).toFixed(1)}%</span>
                        </div>
                        <div class="sentiment-bar">
                            <div class="sentiment-fill" 
                                 style="width: ${((business.sentimentScore + 1) / 2 * 100).toFixed(1)}%; 
                                        background: ${getSentimentColor(business.sentimentScore)}">
                            </div>
                        </div>
                    </div>

                    <div class="comparison-item">
                        <h4>Badges</h4>
                        <div class="badge-list">
                            ${business.badges.map(badge => `
                                <span class="business-badge">${badge}</span>
                            `).join('')}
                        </div>
                    </div>

                    <div class="comparison-item">
                        <h4>Aspect Sentiment</h4>
                        ${Array.from(business.aspectSentiment).map(([aspect, data]) => `
                            <div class="metric-row">
                                <span class="metric-label">${aspect}</span>
                                <span class="metric-value">${(data.score * 100).toFixed(1)}%</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="comparison-item">
                        <h4>Statistics</h4>
                        <div class="metric-row">
                            <span class="metric-label">Visit Count</span>
                            <span class="metric-value">${business.visitCount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // Get AI analysis
            const analysis = await this.getAIAnalysis(businesses);
            aiAnalysis.innerHTML = this.formatAIAnalysis(analysis);

        } catch (error) {
            console.error('Error showing comparison:', error);
            grid.innerHTML = '<div class="error-message">Error loading comparison data</div>';
        }
    },

    async getAIAnalysis: function(businesses) {
        try {
            const response = await fetch('/api/compare-businesses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    businesses: businesses.map(b => ({
                        name: b.name,
                        sentimentScore: b.sentimentScore,
                        badges: b.badges,
                        aspectSentiment: Object.fromEntries(b.aspectSentiment),
                        visitCount: b.visitCount
                    }))
                })
            });

            if (!response.ok) throw new Error('Failed to get AI analysis');
            return await response.json();

        } catch (error) {
            console.error('Error getting AI analysis:', error);
            return {
                error: 'Failed to generate analysis'
            };
        }
    },

    formatAIAnalysis: function(analysis) {
        if (analysis.error) {
            return `<div class="error-message">${analysis.error}</div>`;
        }

        return `
            <div class="analysis-section">
                <h5>Key Differences</h5>
                <ul>
                    ${analysis.differences.map(diff => `
                        <li>${this.highlightComparison(diff)}</li>
                    `).join('')}
                </ul>
            </div>
            <div class="analysis-section">
                <h5>Common Strengths</h5>
                <ul>
                    ${analysis.commonStrengths.map(strength => `
                        <li>${strength}</li>
                    `).join('')}
                </ul>
            </div>
            <div class="analysis-section">
                <h5>Recommendation</h5>
                <p>${analysis.recommendation}</p>
            </div>
        `;
    },

    highlightComparison: function(text) {
        return text.replace(/([0-9.]+%)/g, '<span class="comparison-highlight">$1</span>');
    }
};

// Update marker creation to include comparison functionality
const originalCreateMarker = createCustomMarker;
createCustomMarker = function(business) {
    const marker = originalCreateMarker(business);
    
    // Add comparison button to popup
    const originalPopup = marker.getPopup();
    marker.on('popupopen', () => {
        const popup = marker.getPopup();
        const container = popup.getContent();
        
        // Add comparison button if not already present
        if (!container.querySelector('.compare-button')) {
            const compareButton = document.createElement('button');
            compareButton.className = 'compare-button';
            compareButton.textContent = BusinessComparison.selectedBusinesses.has(business._id)
                ? 'Remove from Comparison'
                : 'Add to Comparison';
            
            compareButton.addEventListener('click', () => {
                BusinessComparison.toggleBusinessSelection(business);
                compareButton.textContent = BusinessComparison.selectedBusinesses.has(business._id)
                    ? 'Remove from Comparison'
                    : 'Add to Comparison';
            });
            
            container.appendChild(compareButton);
        }
    });

    return marker;
};

// Initialize comparison tool when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    BusinessComparison.init();
});

// Favorites System Implementation
const FavoritesSystem = {
    lists: [],
    
    init: function() {
        this.loadLists();
        this.setupEventListeners();
        this.renderLists();
    },

    loadLists: function() {
        const saved = localStorage.getItem('savedLists');
        this.lists = saved ? JSON.parse(saved) : [
            {
                id: 'favorites',
                name: 'Favorites',
                description: 'Your favorite places',
                places: [],
                isDefault: true
            }
        ];
    },

    setupEventListeners: function() {
        document.getElementById('createListBtn').addEventListener('click', () => {
            this.showListModal();
        });

        document.getElementById('closeListModal').addEventListener('click', () => {
            this.hideListModal();
        });

        document.getElementById('saveList').addEventListener('click', () => {
            this.saveNewList();
        });

        document.getElementById('cancelList').addEventListener('click', () => {
            this.hideListModal();
        });
    },

    showListModal: function(editList = null) {
        const modal = document.getElementById('listModal');
        const titleEl = document.getElementById('listModalTitle');
        const nameInput = document.getElementById('listName');
        const descInput = document.getElementById('listDescription');
        const privateCheck = document.getElementById('listPrivate');

        if (editList) {
            titleEl.textContent = 'Edit List';
            nameInput.value = editList.name;
            descInput.value = editList.description || '';
            privateCheck.checked = editList.private || false;
            document.getElementById('saveList').dataset.editId = editList.id;
        } else {
            titleEl.textContent = 'Create New List';
            nameInput.value = '';
            descInput.value = '';
            privateCheck.checked = false;
            delete document.getElementById('saveList').dataset.editId;
        }

        modal.classList.remove('hidden');
    },

    hideListModal: function() {
        document.getElementById('listModal').classList.add('hidden');
    },

    saveNewList: function() {
        const nameInput = document.getElementById('listName');
        const descInput = document.getElementById('listDescription');
        const privateCheck = document.getElementById('listPrivate');
        const saveBtn = document.getElementById('saveList');

        const listData = {
            id: saveBtn.dataset.editId || `list_${Date.now()}`,
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
            private: privateCheck.checked,
            places: [],
            createdAt: new Date().toISOString()
        };

        if (!listData.name) {
            alert('Please enter a list name');
            return;
        }

        if (saveBtn.dataset.editId) {
            const index = this.lists.findIndex(l => l.id === saveBtn.dataset.editId);
            if (index !== -1) {
                listData.places = this.lists[index].places;
                this.lists[index] = listData;
            }
        } else {
            this.lists.push(listData);
        }

        this.saveLists();
        this.renderLists();
        this.hideListModal();
    },

    saveLists: function() {
        localStorage.setItem('savedLists', JSON.stringify(this.lists));
    },

    renderLists: function() {
        const container = document.getElementById('savedLists');
        container.innerHTML = this.lists.map(list => `
            <div class="saved-list" data-list-id="${list.id}">
                <div class="list-header">
                    <span class="list-name">${list.name}</span>
                    <span class="list-count">${list.places.length} places</span>
                </div>
                ${list.description ? `
                    <div class="list-description">${list.description}</div>
                ` : ''}
                <div class="list-places">
                    ${list.places.slice(0, 3).map(place => `
                        <span class="list-place">${place.name}</span>
                    `).join('')}
                    ${list.places.length > 3 ? `
                        <span class="list-place">+${list.places.length - 3} more</span>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.saved-list').forEach(el => {
            el.addEventListener('click', () => {
                this.showListDetails(el.dataset.listId);
            });
        });
    },

    showListDetails: function(listId) {
        const list = this.lists.find(l => l.id === listId);
        if (!list) return;

        // Center map on list places if any
        if (list.places.length > 0) {
            const bounds = L.latLngBounds(list.places.map(p => [
                p.location.latitude,
                p.location.longitude
            ]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Highlight markers for places in this list
        markers.getLayers().forEach(marker => {
            const business = marker.business;
            if (list.places.some(p => p._id === business._id)) {
                marker.setStyle({ fillColor: '#e74c3c' });
            } else {
                marker.setStyle({ fillColor: getSentimentColor(business.sentimentScore) });
            }
        });
    },

    toggleFavorite: function(business) {
        const defaultList = this.lists.find(l => l.isDefault);
        const index = defaultList.places.findIndex(p => p._id === business._id);

        if (index === -1) {
            defaultList.places.push({
                _id: business._id,
                name: business.name,
                location: business.location
            });
        } else {
            defaultList.places.splice(index, 1);
        }

        this.saveLists();
        this.renderLists();
        return index === -1; // Returns true if added, false if removed
    },

    showAddToListModal: function(business) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add to List</h3>
                    <button class="close-button">×</button>
                </div>
                <div class="list-selection">
                    ${this.lists.map(list => `
                        <div class="list-option">
                            <input type="checkbox" id="list_${list.id}" 
                                   ${list.places.some(p => p._id === business._id) ? 'checked' : ''}>
                            <label for="list_${list.id}">${list.name}</label>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-footer">
                    <button class="primary-button">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.primary-button').addEventListener('click', () => {
            const selectedLists = Array.from(modal.querySelectorAll('input:checked'))
                .map(input => input.id.replace('list_', ''));

            this.lists.forEach(list => {
                const index = list.places.findIndex(p => p._id === business._id);
                if (selectedLists.includes(list.id)) {
                    if (index === -1) {
                        list.places.push({
                            _id: business._id,
                            name: business.name,
                            location: business.location
                        });
                    }
                } else if (index !== -1) {
                    list.places.splice(index, 1);
                }
            });

            this.saveLists();
            this.renderLists();
            modal.remove();
        });
    }
};

// Update marker creation to include favorite button
const originalCreateMarker = createCustomMarker;
createCustomMarker = function(business) {
    const marker = originalCreateMarker(business);
    
    // Add favorite button to popup
    const originalPopup = marker.getPopup();
    marker.on('popupopen', () => {
        const popup = marker.getPopup();
        const container = popup.getContent();
        
        // Add favorite button if not already present
        if (!container.querySelector('.favorite-button')) {
            const favoriteButton = document.createElement('button');
            favoriteButton.className = 'favorite-button';
            const isFavorite = FavoritesSystem.lists.find(l => l.isDefault)
                .places.some(p => p._id === business._id);
            favoriteButton.classList.toggle('active', isFavorite);
            
            favoriteButton.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            `;
            
            favoriteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isNowFavorite = FavoritesSystem.toggleFavorite(business);
                favoriteButton.classList.toggle('active', isNowFavorite);
            });

            // Add "Add to List" button
            const addToListButton = document.createElement('button');
            addToListButton.className = 'add-to-list-button';
            addToListButton.textContent = 'Add to List';
            addToListButton.addEventListener('click', (e) => {
                e.stopPropagation();
                FavoritesSystem.showAddToListModal(business);
            });
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'popup-buttons';
            buttonContainer.appendChild(favoriteButton);
            buttonContainer.appendChild(addToListButton);
            container.appendChild(buttonContainer);
        }
    });

    return marker;
};

// Initialize favorites system when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    FavoritesSystem.init();
});

// Sentiment Trends Implementation
const SentimentTrends = {
    chart: null,
    selectedBusinesses: new Set(),
    colors: [
        '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', 
        '#9b59b6', '#e67e22', '#1abc9c', '#34495e'
    ],

    init: function() {
        this.initChart();
        this.setupEventListeners();
    },

    initChart: function() {
        const ctx = document.getElementById('sentimentTrendChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${(context.parsed.y * 100).toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            callback: function(value) {
                                return (value * 100) + '%';
                            }
                        }
                    }
                }
            }
        });
    },

    setupEventListeners: function() {
        document.getElementById('trendTimeRange').addEventListener('change', () => {
            this.updateTrends();
        });

        document.getElementById('compareTrends').addEventListener('click', () => {
            this.showComparisonModal();
        });
    },

    async fetchTrendData(businessId, days) {
        try {
            const response = await fetch(`/api/businesses/${businessId}/trends?days=${days}`);
            if (!response.ok) throw new Error('Failed to fetch trend data');
            return await response.json();
        } catch (error) {
            console.error('Error fetching trend data:', error);
            return null;
        }
    },

    async updateTrends(businessId = null) {
        const days = parseInt(document.getElementById('trendTimeRange').value);
        
        if (businessId) {
            // Single business update
            const data = await this.fetchTrendData(businessId, days);
            if (data) {
                this.updateChart([{
                    id: businessId,
                    name: data.name,
                    trends: data.trends
                }]);
            }
        } else {
            // Update all selected businesses
            const promises = Array.from(this.selectedBusinesses).map(id => 
                this.fetchTrendData(id, days)
            );
            
            const results = await Promise.all(promises);
            const validResults = results.filter(r => r !== null);
            
            if (validResults.length > 0) {
                this.updateChart(validResults);
            }
        }
    },

    updateChart: function(businessData) {
        const datasets = businessData.map((business, index) => ({
            label: business.name,
            data: business.trends.map(t => t.sentiment),
            borderColor: this.colors[index % this.colors.length],
            backgroundColor: this.colors[index % this.colors.length] + '20',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5
        }));

        this.chart.data.labels = businessData[0].trends.map(t => 
            new Date(t.date).toLocaleDateString()
        );
        this.chart.data.datasets = datasets;
        this.chart.update();

        this.updateLegend(datasets);
    },

    updateLegend: function(datasets) {
        const legend = document.getElementById('trendLegend');
        legend.innerHTML = datasets.map(dataset => `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${dataset.borderColor}"></span>
                <span class="legend-label">${dataset.label}</span>
            </div>
        `).join('');
    },

    toggleBusiness: function(business) {
        const businessId = business._id;
        
        if (this.selectedBusinesses.has(businessId)) {
            this.selectedBusinesses.delete(businessId);
        } else {
            if (this.selectedBusinesses.size >= 5) {
                notifications.add({
                    businessName: 'Trend Limit',
                    message: 'You can compare up to 5 businesses at once',
                    severity: 'medium',
                    timestamp: new Date()
                });
                return;
            }
            this.selectedBusinesses.add(businessId);
        }

        document.getElementById('compareTrends').disabled = 
            this.selectedBusinesses.size < 2;

        this.updateTrends();
    },

    showComparisonModal: function() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content trend-comparison-modal">
                <div class="modal-header">
                    <h3>Compare Sentiment Trends</h3>
                    <button class="close-button">×</button>
                </div>
                <div class="trend-comparison-content">
                    <canvas id="comparisonTrendChart"></canvas>
                </div>
                <div class="trend-controls">
                    <select id="comparisonTimeRange">
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const ctx = modal.querySelector('#comparisonTrendChart').getContext('2d');
        const comparisonChart = new Chart(ctx, {
            type: 'line',
            data: this.chart.data,
            options: {
                ...this.chart.options,
                aspectRatio: 2,
                plugins: {
                    ...this.chart.options.plugins,
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });

        // Add event listeners
        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#comparisonTimeRange').addEventListener('change', (e) => {
            this.updateTrends();
            comparisonChart.data = this.chart.data;
            comparisonChart.update();
        });
    }
};

// Update marker creation to include trend toggle
const originalCreateMarker = createCustomMarker;
createCustomMarker = function(business) {
    const marker = originalCreateMarker(business);
    
    marker.on('popupopen', () => {
        const popup = marker.getPopup();
        const container = popup.getContent();
        
        if (!container.querySelector('.trend-button')) {
            const trendButton = document.createElement('button');
            trendButton.className = 'trend-button';
            trendButton.textContent = SentimentTrends.selectedBusinesses.has(business._id)
                ? 'Remove from Trends'
                : 'Add to Trends';
            
            trendButton.addEventListener('click', (e) => {
                e.stopPropagation();
                SentimentTrends.toggleBusiness(business);
                trendButton.textContent = SentimentTrends.selectedBusinesses.has(business._id)
                    ? 'Remove from Trends'
                    : 'Add to Trends';
            });
            
            container.appendChild(trendButton);
        }
    });

    return marker;
};

// Initialize sentiment trends when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    SentimentTrends.init();
});

// Quick Filters Implementation
const QuickFilters = {
    activeFilters: new Set(),
    
    init: function() {
        this.setupEventListeners();
        this.updateUI();
    },

    setupEventListeners: function() {
        // Filter tag click handlers
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                this.toggleFilter(tag.dataset.filter);
            });
        });

        // Clear filters button
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Active filter removal
        document.getElementById('activeFilters').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-filter')) {
                const filter = e.target.closest('.active-filter').dataset.filter;
                this.removeFilter(filter);
            }
        });
    },

    toggleFilter: function(filter) {
        const filterTag = document.querySelector(`.filter-tag[data-filter="${filter}"]`);
        
        if (this.activeFilters.has(filter)) {
            this.activeFilters.delete(filter);
            filterTag.classList.remove('active');
        } else {
            this.activeFilters.add(filter);
            filterTag.classList.add('active');
        }

        this.updateUI();
        this.applyFilters();
    },

    removeFilter: function(filter) {
        this.activeFilters.delete(filter);
        document.querySelector(`.filter-tag[data-filter="${filter}"]`)
            ?.classList.remove('active');
        
        this.updateUI();
        this.applyFilters();
    },

    clearFilters: function() {
        this.activeFilters.clear();
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.classList.remove('active');
        });
        
        this.updateUI();
        this.applyFilters();
    },

    updateUI: function() {
        // Update clear filters button visibility
        const clearButton = document.getElementById('clearFilters');
        clearButton.style.display = this.activeFilters.size > 0 ? 'block' : 'none';

        // Update active filters display
        const activeFiltersContainer = document.getElementById('activeFilters');
        if (this.activeFilters.size === 0) {
            activeFiltersContainer.innerHTML = '';
            return;
        }

        activeFiltersContainer.innerHTML = Array.from(this.activeFilters)
            .map(filter => {
                const tag = document.querySelector(`.filter-tag[data-filter="${filter}"]`);
                const icon = tag.querySelector('.tag-icon').textContent;
                return `
                    <div class="active-filter" data-filter="${filter}">
                        ${icon} ${tag.textContent.trim()}
                        <span class="remove-filter">×</span>
                    </div>
                `;
            })
            .join('');
    },

    applyFilters: function() {
        if (this.activeFilters.size === 0) {
            // Show all businesses
            optimizedUpdateMap(allBusinesses);
            return;
        }

        // Filter businesses based on active filters
        const filteredBusinesses = allBusinesses.filter(business => {
            return Array.from(this.activeFilters).some(filter => {
                switch(filter) {
                    case 'top-rated':
                        return business.sentimentScore >= 0.8;
                    case 'trending':
                        return business.badges.includes('Trending');
                    case 'new':
                        return business.badges.includes('New');
                    case 'budget-friendly':
                        return business.badges.includes('Budget-Friendly');
                    case 'family-friendly':
                        return business.badges.includes('Family-Friendly');
                    case 'outdoor-seating':
                        return business.badges.includes('Outdoor Seating');
                    case 'italian':
                        return business.categories.includes('Italian');
                    case 'asian':
                        return business.categories.includes('Asian');
                    case 'vegetarian':
                        return business.categories.includes('Vegetarian');
                    default:
                        return false;
                }
            });
        });

        // Update map with filtered businesses
        optimizedUpdateMap(filteredBusinesses);

        // Update filter counts
        this.updateFilterCounts(filteredBusinesses);
    },

    updateFilterCounts: function(filteredBusinesses) {
        document.querySelectorAll('.filter-tag').forEach(tag => {
            const filter = tag.dataset.filter;
            const count = this.getFilterCount(filter, filteredBusinesses);
            
            // Update or create count element
            let countElement = tag.querySelector('.filter-count');
            if (count > 0) {
                if (!countElement) {
                    countElement = document.createElement('span');
                    countElement.className = 'filter-count';
                    tag.appendChild(countElement);
                }
                countElement.textContent = count;
            } else if (countElement) {
                countElement.remove();
            }
        });
    },

    getFilterCount: function(filter, businesses) {
        return businesses.filter(business => {
            switch(filter) {
                case 'top-rated':
                    return business.sentimentScore >= 0.8;
                case 'trending':
                    return business.badges.includes('Trending');
                case 'new':
                    return business.badges.includes('New');
                case 'budget-friendly':
                    return business.badges.includes('Budget-Friendly');
                case 'family-friendly':
                    return business.badges.includes('Family-Friendly');
                case 'outdoor-seating':
                    return business.badges.includes('Outdoor Seating');
                case 'italian':
                    return business.categories.includes('Italian');
                case 'asian':
                    return business.categories.includes('Asian');
                case 'vegetarian':
                    return business.categories.includes('Vegetarian');
                default:
                    return false;
            }
        }).length;
    }
};

// Initialize quick filters when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    QuickFilters.init();
});

// Review Highlights Implementation
const ReviewHighlights = {
    currentBusinessId: null,

    init: function() {
        this.setupEventListeners();
    },

    setupEventListeners: function() {
        // Update highlights when a business marker is clicked
        markers.on('click', (e) => {
            const business = e.layer.business;
            if (business) {
                this.updateHighlights(business._id);
            }
        });
    },

    async updateHighlights: function(businessId) {
        if (this.currentBusinessId === businessId) return;
        this.currentBusinessId = businessId;

        try {
            const response = await fetch(`/api/businesses/${businessId}/highlights`);
            if (!response.ok) throw new Error('Failed to fetch highlights');
            
            const highlights = await response.json();
            this.renderHighlights(highlights);
        } catch (error) {
            console.error('Error fetching highlights:', error);
            this.showError();
        }
    },

    renderHighlights: function(highlights) {
        // Update review count
        document.getElementById('totalReviewCount').textContent = 
            `${highlights.totalReviews} reviews`;

        // Render feature cloud
        const featureCloud = document.getElementById('featureCloud');
        featureCloud.innerHTML = highlights.features
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(feature => `
                <div class="feature-tag">
                    ${feature.text}
                    <span class="feature-count">${feature.count}</span>
                </div>
            `).join('');

        // Render pros
        const prosList = document.getElementById('prosList');
        prosList.innerHTML = highlights.pros
            .map(pro => `
                <li>
                    <span class="highlight-text">${pro.text}</span>
                    ${pro.example ? `
                        <small class="highlight-example">
                            "${pro.example}"
                        </small>
                    ` : ''}
                </li>
            `).join('');

        // Render cons
        const consList = document.getElementById('consList');
        consList.innerHTML = highlights.cons
            .map(con => `
                <li>
                    <span class="highlight-text">${con.text}</span>
                    ${con.example ? `
                        <small class="highlight-example">
                            "${con.example}"
                        </small>
                    ` : ''}
                </li>
            `).join('');

        // Render common phrases
        const phraseList = document.getElementById('phraseList');
        phraseList.innerHTML = highlights.commonPhrases
            .map(phrase => `
                <div class="phrase-item">
                    <div class="sentiment-indicator ${this.getSentimentClass(phrase.sentiment)}"></div>
                    <span class="phrase-text">${phrase.text}</span>
                    <span class="phrase-frequency">${phrase.count}×</span>
                </div>
            `).join('');
    },

    getSentimentClass: function(sentiment) {
        if (sentiment >= 0.3) return 'sentiment-positive';
        if (sentiment <= -0.3) return 'sentiment-negative';
        return 'sentiment-neutral';
    },

    showError: function() {
        const containers = ['featureCloud', 'prosList', 'consList', 'phraseList'];
        containers.forEach(id => {
            document.getElementById(id).innerHTML = `
                <div class="error-message">
                    Failed to load review highlights
                </div>
            `;
        });
    }
};

// Initialize review highlights when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    ReviewHighlights.init();
});

// Photo Gallery Implementation
const PhotoGallery = {
    currentBusinessId: null,
    photos: [],
    currentPhotoIndex: 0,

    init: function() {
        this.setupEventListeners();
    },

    setupEventListeners: function() {
        document.getElementById('photoUpload').addEventListener('change', (e) => {
            this.handlePhotoUpload(e.target.files);
        });

        // Close lightbox on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox();
            }
        });
    },

    async handlePhotoUpload(files) {
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('photos', file);
        });

        const progressBar = document.createElement('div');
        progressBar.className = 'upload-progress';
        progressBar.innerHTML = '<div class="progress-bar"></div>';
        document.querySelector('.upload-section').appendChild(progressBar);

        try {
            const response = await fetch(`/api/businesses/${this.currentBusinessId}/photos`, {
                method: 'POST',
                body: formData,
                onUploadProgress: (progressEvent) => {
                    const progress = (progressEvent.loaded / progressEvent.total) * 100;
                    progressBar.querySelector('.progress-bar').style.width = `${progress}%`;
                }
            });

            if (!response.ok) throw new Error('Upload failed');

            const result = await response.json();
            this.photos.push(...result.photos);
            this.renderGallery();

            // Remove progress bar after success
            setTimeout(() => {
                progressBar.remove();
            }, 1000);

        } catch (error) {
            console.error('Error uploading photos:', error);
            progressBar.innerHTML = '<div class="error">Upload failed</div>';
            setTimeout(() => {
                progressBar.remove();
            }, 3000);
        }
    },

    async loadPhotos(businessId) {
        this.currentBusinessId = businessId;
        try {
            const response = await fetch(`/api/businesses/${businessId}/photos`);
            if (!response.ok) throw new Error('Failed to load photos');
            
            const data = await response.json();
            this.photos = data.photos;
            this.renderGallery();
        } catch (error) {
            console.error('Error loading photos:', error);
        }
    },

    renderGallery: function() {
        const grid = document.getElementById('photoGrid');
        grid.innerHTML = this.photos.map((photo, index) => `
            <div class="gallery-item" onclick="PhotoGallery.showLightbox(${index})">
                <img src="${photo.thumbnailUrl}" alt="Business photo">
                <div class="photo-date">
                    ${new Date(photo.uploadDate).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    },

    showLightbox: function(index) {
        this.currentPhotoIndex = index;
        const photo = this.photos[index];

        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <img src="${photo.fullUrl}" alt="Business photo" class="lightbox-image">
                <div class="lightbox-nav">
                    <button class="lightbox-button prev">←</button>
                    <button class="lightbox-button next">→</button>
                </div>
                <div class="lightbox-info">
                    <div>${photo.caption || ''}</div>
                    <small>Uploaded by ${photo.uploadedBy} on ${new Date(photo.uploadDate).toLocaleDateString()}</small>
                </div>
            </div>
        `;

        document.body.appendChild(lightbox);

        // Add event listeners
        lightbox.querySelector('.prev').addEventListener('click', () => {
            this.navigateLightbox('prev');
        });

        lightbox.querySelector('.next').addEventListener('click', () => {
            this.navigateLightbox('next');
        });

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                this.closeLightbox();
            }
        });
    },

    navigateLightbox: function(direction) {
        if (direction === 'prev') {
            this.currentPhotoIndex = (this.currentPhotoIndex - 1 + this.photos.length) % this.photos.length;
        } else {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
        }

        const photo = this.photos[this.currentPhotoIndex];
        const lightboxImage = document.querySelector('.lightbox-image');
        const lightboxInfo = document.querySelector('.lightbox-info');

        lightboxImage.src = photo.fullUrl;
        lightboxInfo.innerHTML = `
            <div>${photo.caption || ''}</div>
            <small>Uploaded by ${photo.uploadedBy} on ${new Date(photo.uploadDate).toLocaleDateString()}</small>
        `;
    },

    closeLightbox: function() {
        const lightbox = document.querySelector('.lightbox');
        if (lightbox) {
            lightbox.remove();
        }
    }
};

// Update marker popup creation to include photo gallery
const originalCreatePopupContent = createPopupContent;
createPopupContent = function(business) {
    const content = originalCreatePopupContent(business);
    const container = document.createElement('div');
    container.innerHTML = content;

    // Add photo gallery section
    const gallerySection = document.createElement('div');
    gallerySection.className = 'photo-gallery';
    gallerySection.innerHTML = `
        <h4>Photos</h4>
        <div class="gallery-grid" id="photoGrid">
            <!-- Photos will be populated here -->
        </div>
        <div class="upload-section">
            <label for="photoUpload" class="upload-button">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
                </svg>
                Add Photos
            </label>
            <input type="file" id="photoUpload" accept="image/*" multiple style="display: none;">
        </div>
    `;
    container.appendChild(gallerySection);

    // Load photos when popup is created
    setTimeout(() => {
        PhotoGallery.loadPhotos(business._id);
    }, 0);

    return container.innerHTML;
};

// Initialize photo gallery when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    PhotoGallery.init();
});

// Notification Settings Implementation
const NotificationSettings = {
    settings: {
        enabled: true,
        alerts: {
            newReviews: true,
            sentimentChanges: true,
            nearbyPromotions: false
        },
        thresholds: {
            sentiment: 0.10,
            proximity: 2000
        },
        businessAlerts: []
    },

    init: function() {
        this.loadSettings();
        this.setupEventListeners();
        this.updateSummary();
    },

    loadSettings: function() {
        const saved = localStorage.getItem('notificationSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
    },

    setupEventListeners: function() {
        document.getElementById('editNotificationSettings').addEventListener('click', () => {
            this.showSettingsModal();
        });

        document.getElementById('closeNotificationSettings').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        document.getElementById('saveNotificationSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('enableNotifications').addEventListener('change', (e) => {
            this.toggleAllNotifications(e.target.checked);
        });

        document.getElementById('addBusinessAlert').addEventListener('click', () => {
            this.addBusinessAlert();
        });
    },

    showSettingsModal: function() {
        const modal = document.getElementById('notificationSettingsModal');
        
        // Set current values
        document.getElementById('enableNotifications').checked = this.settings.enabled;
        document.getElementById('newReviewsAlert').checked = this.settings.alerts.newReviews;
        document.getElementById('sentimentAlert').checked = this.settings.alerts.sentimentChanges;
        document.getElementById('nearbyAlert').checked = this.settings.alerts.nearbyPromotions;
        document.getElementById('sentimentThreshold').value = this.settings.thresholds.sentiment;
        document.getElementById('proximityRange').value = this.settings.thresholds.proximity;

        // Populate business alerts
        this.renderBusinessAlerts();

        modal.classList.remove('hidden');
    },

    hideSettingsModal: function() {
        document.getElementById('notificationSettingsModal').classList.add('hidden');
    },

    toggleAllNotifications: function(enabled) {
        const alertToggles = document.querySelectorAll('.settings-section input[type="checkbox"]');
        alertToggles.forEach(toggle => {
            if (toggle.id !== 'enableNotifications') {
                toggle.disabled = !enabled;
                if (!enabled) toggle.checked = false;
            }
        });
    },

    addBusinessAlert: function() {
        const businessAlertTemplate = `
            <div class="business-alert">
                <div class="business-alert-header">
                    <select class="business-select">
                        <option value="">Select Business...</option>
                        ${this.getBusinessOptions()}
                    </select>
                    <button class="remove-alert">×</button>
                </div>
                <div class="business-alert-settings">
                    <label>
                        <input type="checkbox" class="alert-option" value="reviews">
                        New Reviews
                    </label>
                    <label>
                        <input type="checkbox" class="alert-option" value="sentiment">
                        Sentiment Changes
                    </label>
                    <label>
                        <input type="checkbox" class="alert-option" value="promotions">
                        Promotions
                    </label>
                </div>
            </div>
        `;

        const container = document.getElementById('businessAlerts');
        const alertElement = document.createElement('div');
        alertElement.innerHTML = businessAlertTemplate;
        container.appendChild(alertElement);

        // Add remove handler
        alertElement.querySelector('.remove-alert').addEventListener('click', () => {
            alertElement.remove();
        });
    },

    getBusinessOptions: function() {
        return FavoritesSystem.lists
            .flatMap(list => list.places)
            .map(place => `
                <option value="${place._id}">${place.name}</option>
            `)
            .join('');
    },

    renderBusinessAlerts: function() {
        const container = document.getElementById('businessAlerts');
        container.innerHTML = this.settings.businessAlerts
            .map(alert => `
                <div class="business-alert">
                    <div class="business-alert-header">
                        <strong>${alert.businessName}</strong>
                        <button class="remove-alert" data-id="${alert.businessId}">×</button>
                    </div>
                    <div class="business-alert-settings">
                        <label>
                            <input type="checkbox" class="alert-option" 
                                   value="reviews" ${alert.alerts.reviews ? 'checked' : ''}>
                            New Reviews
                        </label>
                        <label>
                            <input type="checkbox" class="alert-option" 
                                   value="sentiment" ${alert.alerts.sentiment ? 'checked' : ''}>
                            Sentiment Changes
                        </label>
                        <label>
                            <input type="checkbox" class="alert-option" 
                                   value="promotions" ${alert.alerts.promotions ? 'checked' : ''}>
                            Promotions
                        </label>
                    </div>
                </div>
            `)
            .join('');

        // Add remove handlers
        container.querySelectorAll('.remove-alert').forEach(button => {
            button.addEventListener('click', () => {
                this.removeBusinessAlert(button.dataset.id);
            });
        });
    },

    removeBusinessAlert: function(businessId) {
        this.settings.businessAlerts = this.settings.businessAlerts
            .filter(alert => alert.businessId !== businessId);
        this.renderBusinessAlerts();
    },

    saveSettings: function() {
        this.settings = {
            enabled: document.getElementById('enableNotifications').checked,
            alerts: {
                newReviews: document.getElementById('newReviewsAlert').checked,
                sentimentChanges: document.getElementById('sentimentAlert').checked,
                nearbyPromotions: document.getElementById('nearbyAlert').checked
            },
            thresholds: {
                sentiment: parseFloat(document.getElementById('sentimentThreshold').value),
                proximity: parseInt(document.getElementById('proximityRange').value)
            },
            businessAlerts: this.getBusinessAlertSettings()
        };

        localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
        this.updateSummary();
        this.hideSettingsModal();

        notifications.add({
            businessName: 'Settings Updated',
            message: 'Notification preferences have been saved',
            severity: 'low',
            timestamp: new Date()
        });
    },

    getBusinessAlertSettings: function() {
        return Array.from(document.querySelectorAll('.business-alert')).map(alert => {
            const businessSelect = alert.querySelector('.business-select');
            const alertOptions = alert.querySelectorAll('.alert-option');
            
            return {
                businessId: businessSelect.value,
                businessName: businessSelect.options[businessSelect.selectedIndex].text,
                alerts: {
                    reviews: alertOptions[0].checked,
                    sentiment: alertOptions[1].checked,
                    promotions: alertOptions[2].checked
                }
            };
        });
    },

    updateSummary: function() {
        const summary = document.getElementById('notificationSummary');
        if (!this.settings.enabled) {
            summary.innerHTML = '<span class="inactive-setting">All notifications are currently disabled</span>';
            return;
        }

        const activeAlerts = [];
        if (this.settings.alerts.newReviews) activeAlerts.push('New Reviews');
        if (this.settings.alerts.sentimentChanges) {
            activeAlerts.push(`Sentiment Changes (${this.settings.thresholds.sentiment * 100}% threshold)`);
        }
        if (this.settings.alerts.nearbyPromotions) {
            activeAlerts.push(`Nearby Promotions (${this.settings.thresholds.proximity / 1000}km radius)`);
        }
