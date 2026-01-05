/**
 * GPS Location Manager
 * نظام تسجيل الموقع الجغرافي مع روابط الخرائط
 */

// Location State
const LOCATION_STATE = {
    currentPosition: null,
    watchId: null,
    isTracking: false,
    lastUpdate: null,
    accuracy: null
};

// Google Maps base URL
const GOOGLE_MAPS_BASE = 'https://www.google.com/maps';

/**
 * Initialize GPS Manager
 */
function initGPSManager() {
    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        return false;
    }

    // Request permission and get initial position
    getCurrentLocation();
    return true;
}

/**
 * Get current location
 */
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000 // Cache for 1 minute
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                LOCATION_STATE.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    timestamp: new Date().toISOString()
                };
                LOCATION_STATE.lastUpdate = new Date();
                LOCATION_STATE.accuracy = position.coords.accuracy;
                
                updateLocationDisplay();
                resolve(LOCATION_STATE.currentPosition);
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMsg = 'فشل الحصول على الموقع';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'تم رفض إذن الموقع. يرجى السماح بالوصول للموقع.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'معلومات الموقع غير متاحة';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'انتهت مهلة طلب الموقع';
                        break;
                }
                
                showToast(errorMsg, 'error');
                reject(error);
            },
            options
        );
    });
}

/**
 * Start continuous location tracking
 */
function startLocationTracking() {
    if (!navigator.geolocation) return;
    
    if (LOCATION_STATE.watchId) {
        stopLocationTracking();
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000
    };

    LOCATION_STATE.watchId = navigator.geolocation.watchPosition(
        (position) => {
            LOCATION_STATE.currentPosition = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                timestamp: new Date().toISOString()
            };
            LOCATION_STATE.lastUpdate = new Date();
            LOCATION_STATE.isTracking = true;
            
            updateLocationDisplay();
        },
        (error) => {
            console.error('Watch position error:', error);
        },
        options
    );

    showToast('تم تفعيل تتبع الموقع', 'success');
}

/**
 * Stop location tracking
 */
function stopLocationTracking() {
    if (LOCATION_STATE.watchId) {
        navigator.geolocation.clearWatch(LOCATION_STATE.watchId);
        LOCATION_STATE.watchId = null;
        LOCATION_STATE.isTracking = false;
        showToast('تم إيقاف تتبع الموقع', 'info');
    }
}

/**
 * Update location display in UI
 */
function updateLocationDisplay() {
    const displayEl = document.getElementById('currentLocationDisplay');
    if (displayEl && LOCATION_STATE.currentPosition) {
        const pos = LOCATION_STATE.currentPosition;
        displayEl.innerHTML = `
            <div class="flex items-center gap-2 text-sm">
                <i class="fas fa-map-marker-alt text-green-500"></i>
                <span>${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}</span>
                ${pos.accuracy ? `<span class="text-gray-400">(±${Math.round(pos.accuracy)}م)</span>` : ''}
            </div>
        `;
    }

    // Update hidden form fields if they exist
    const latField = document.getElementById('assetLatitude');
    const lngField = document.getElementById('assetLongitude');
    
    if (latField && LOCATION_STATE.currentPosition) {
        latField.value = LOCATION_STATE.currentPosition.latitude;
    }
    if (lngField && LOCATION_STATE.currentPosition) {
        lngField.value = LOCATION_STATE.currentPosition.longitude;
    }
}

/**
 * Get location data for asset
 */
function getLocationForAsset() {
    if (LOCATION_STATE.currentPosition) {
        return {
            latitude: LOCATION_STATE.currentPosition.latitude,
            longitude: LOCATION_STATE.currentPosition.longitude,
            accuracy: LOCATION_STATE.currentPosition.accuracy,
            altitude: LOCATION_STATE.currentPosition.altitude,
            capturedAt: LOCATION_STATE.currentPosition.timestamp,
            mapLink: generateGoogleMapsLink(
                LOCATION_STATE.currentPosition.latitude,
                LOCATION_STATE.currentPosition.longitude
            )
        };
    }
    return null;
}

/**
 * Generate Google Maps link for coordinates
 */
function generateGoogleMapsLink(latitude, longitude) {
    return `${GOOGLE_MAPS_BASE}?q=${latitude},${longitude}`;
}

/**
 * Generate Google Maps embed URL
 */
function generateGoogleMapsEmbed(latitude, longitude) {
    return `${GOOGLE_MAPS_BASE}/embed?pb=!1m18!1m12!1m3!1d500!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM!5e0!3m2!1sen!2s!4v1234567890`;
}

/**
 * Generate directions link
 */
function generateDirectionsLink(latitude, longitude) {
    return `${GOOGLE_MAPS_BASE}/dir/?api=1&destination=${latitude},${longitude}`;
}

/**
 * Open location in Google Maps
 */
function openInGoogleMaps(latitude, longitude) {
    const link = generateGoogleMapsLink(latitude, longitude);
    window.open(link, '_blank');
}

/**
 * Open directions to location
 */
function openDirectionsTo(latitude, longitude) {
    const link = generateDirectionsLink(latitude, longitude);
    window.open(link, '_blank');
}

/**
 * Render location map preview
 */
function renderLocationPreview(container, latitude, longitude, options = {}) {
    if (!container) return;

    const {
        width = '100%',
        height = '200px',
        showControls = true
    } = options;

    container.innerHTML = `
        <div class="location-preview rounded-lg overflow-hidden" style="width: ${width}; height: ${height};">
            <div class="relative h-full bg-gray-100">
                <iframe
                    src="https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed"
                    width="100%"
                    height="100%"
                    style="border:0;"
                    allowfullscreen=""
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade">
                </iframe>
                ${showControls ? `
                    <div class="absolute bottom-2 right-2 flex gap-2">
                        <button onclick="openInGoogleMaps(${latitude}, ${longitude})" 
                                class="bg-white px-3 py-1 rounded-lg shadow text-sm hover:bg-gray-100">
                            <i class="fas fa-external-link-alt ml-1"></i> فتح في الخرائط
                        </button>
                        <button onclick="openDirectionsTo(${latitude}, ${longitude})" 
                                class="bg-gov-blue text-white px-3 py-1 rounded-lg shadow text-sm hover:bg-gov-blue-light">
                            <i class="fas fa-directions ml-1"></i> الاتجاهات
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance; // Returns distance in km
}

/**
 * Convert degrees to radians
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} متر`;
    }
    return `${distanceKm.toFixed(2)} كم`;
}

/**
 * Get assets near current location
 */
function getAssetsNearby(radius = 1) { // radius in km
    if (!LOCATION_STATE.currentPosition) return [];

    const currentLat = LOCATION_STATE.currentPosition.latitude;
    const currentLng = LOCATION_STATE.currentPosition.longitude;

    return APP_STATE.assets
        .filter(asset => asset.gpsLocation?.latitude && asset.gpsLocation?.longitude)
        .map(asset => ({
            ...asset,
            distance: calculateDistance(
                currentLat, currentLng,
                asset.gpsLocation.latitude,
                asset.gpsLocation.longitude
            )
        }))
        .filter(asset => asset.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
}

/**
 * Render nearby assets list
 */
function renderNearbyAssets(container, radius = 1) {
    if (!container) return;

    const nearbyAssets = getAssetsNearby(radius);

    if (nearbyAssets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-map-marker-alt text-4xl mb-4"></i>
                <p>لا توجد أصول قريبة ضمن ${radius} كم</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-3">
            ${nearbyAssets.map(asset => `
                <div class="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <h4 class="font-medium text-gray-800">${asset.name}</h4>
                        <p class="text-sm text-gray-500">${asset.location || 'بدون موقع'}</p>
                    </div>
                    <div class="text-left">
                        <p class="text-sm font-medium text-gov-blue">${formatDistance(asset.distance)}</p>
                        <button onclick="openDirectionsTo(${asset.gpsLocation.latitude}, ${asset.gpsLocation.longitude})"
                                class="text-xs text-gray-500 hover:text-gov-blue">
                            <i class="fas fa-directions"></i> الاتجاهات
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Refresh current location
 */
async function refreshLocation() {
    const btn = document.getElementById('refreshLocationBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        await getCurrentLocation();
        showToast('تم تحديث الموقع', 'success');
    } catch (e) {
        // Error already shown in getCurrentLocation
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync"></i>';
        }
    }
}

/**
 * Export GPS functions for global use
 */
window.GPSManager = {
    init: initGPSManager,
    getCurrentLocation,
    startTracking: startLocationTracking,
    stopTracking: stopLocationTracking,
    getLocationForAsset,
    generateMapLink: generateGoogleMapsLink,
    openInMaps: openInGoogleMaps,
    openDirections: openDirectionsTo,
    renderPreview: renderLocationPreview,
    getNearbyAssets: getAssetsNearby,
    refresh: refreshLocation
};
