/**
 * Geolocation Module
 * نظام تسجيل الموقع الجغرافي
 * Version 6.0
 */

// === Geolocation State ===
let GEO_STATE = {
    watchId: null,
    currentPosition: null,
    isTracking: false,
    lastUpdate: null,
    accuracy: null,
    error: null
};

// === Initialize Geolocation ===
function initializeGeolocation() {
    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        GEO_STATE.error = 'الموقع الجغرافي غير مدعوم في هذا المتصفح';
        return false;
    }
    
    // Get initial position
    getPosition();
    
    return true;
}

// === Get Current Position ===
function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                GEO_STATE.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed
                };
                GEO_STATE.lastUpdate = new Date();
                GEO_STATE.accuracy = position.coords.accuracy;
                GEO_STATE.error = null;
                
                resolve(GEO_STATE.currentPosition);
            },
            (error) => {
                handleGeolocationError(error);
                reject(error);
            },
            options
        );
    });
}

// === Start Tracking ===
function startTracking(callback) {
    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported');
        return null;
    }
    
    if (GEO_STATE.isTracking) {
        console.log('Already tracking');
        return GEO_STATE.watchId;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };
    
    GEO_STATE.watchId = navigator.geolocation.watchPosition(
        (position) => {
            GEO_STATE.currentPosition = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed
            };
            GEO_STATE.lastUpdate = new Date();
            GEO_STATE.accuracy = position.coords.accuracy;
            GEO_STATE.error = null;
            GEO_STATE.isTracking = true;
            
            if (callback) {
                callback(GEO_STATE.currentPosition);
            }
            
            updateLocationDisplay();
        },
        (error) => {
            handleGeolocationError(error);
            GEO_STATE.isTracking = false;
        },
        options
    );
    
    return GEO_STATE.watchId;
}

// === Stop Tracking ===
function stopTracking() {
    if (GEO_STATE.watchId !== null) {
        navigator.geolocation.clearWatch(GEO_STATE.watchId);
        GEO_STATE.watchId = null;
        GEO_STATE.isTracking = false;
        console.log('Stopped tracking location');
    }
}

// === Handle Geolocation Error ===
function handleGeolocationError(error) {
    let errorMessage = '';
    
    switch (error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'تم رفض إذن الوصول للموقع الجغرافي';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'معلومات الموقع غير متاحة';
            break;
        case error.TIMEOUT:
            errorMessage = 'انتهت مهلة طلب الموقع';
            break;
        default:
            errorMessage = 'حدث خطأ غير معروف';
            break;
    }
    
    GEO_STATE.error = errorMessage;
    console.warn('Geolocation error:', errorMessage);
    
    // Show toast notification
    if (typeof showToast === 'function') {
        showToast(errorMessage, 'warning');
    }
}

// === Update Location Display ===
function updateLocationDisplay() {
    const locationDisplay = document.getElementById('currentLocationDisplay');
    const accuracyDisplay = document.getElementById('locationAccuracy');
    
    if (locationDisplay && GEO_STATE.currentPosition) {
        const { latitude, longitude } = GEO_STATE.currentPosition;
        locationDisplay.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
    if (accuracyDisplay && GEO_STATE.accuracy) {
        const accuracyText = GEO_STATE.accuracy < 10 
            ? 'دقة عالية' 
            : GEO_STATE.accuracy < 50 
                ? 'دقة متوسطة' 
                : 'دقة منخفضة';
        accuracyDisplay.textContent = `${accuracyText} (${Math.round(GEO_STATE.accuracy)}م)`;
    }
}

// === Generate Google Maps Link ===
function createGoogleMapsLink(latitude, longitude, label = '') {
    if (!latitude || !longitude) return null;
    
    // Standard Google Maps link
    const baseUrl = 'https://www.google.com/maps';
    
    // Link that opens in Google Maps app or web
    const searchLink = `${baseUrl}/search/?api=1&query=${latitude},${longitude}`;
    
    // Direct coordinates link
    const coordsLink = `${baseUrl}?q=${latitude},${longitude}`;
    
    // With label/marker
    const markerLink = label 
        ? `${baseUrl}/search/?api=1&query=${encodeURIComponent(label)}@${latitude},${longitude}`
        : coordsLink;
    
    return {
        standard: coordsLink,
        search: searchLink,
        marker: markerLink,
        embed: `${baseUrl}/embed?pb=!1m14!1m12!1m3!1d500!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2ssa!4v1`,
        directions: `${baseUrl}/dir/?api=1&destination=${latitude},${longitude}`
    };
}

// === Get Location with Address (Reverse Geocoding) ===
async function getLocationWithAddress() {
    try {
        const position = await getPosition();
        
        // Try to get address using OpenStreetMap Nominatim (free)
        const { latitude, longitude } = position;
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar`,
                {
                    headers: {
                        'User-Agent': 'AssetInventorySystem/6.0'
                    }
                }
            );
            
            if (response.ok) {
                const data = await response.json();
                position.address = data.display_name;
                position.addressDetails = {
                    road: data.address?.road,
                    suburb: data.address?.suburb,
                    city: data.address?.city || data.address?.town,
                    state: data.address?.state,
                    country: data.address?.country,
                    postcode: data.address?.postcode
                };
            }
        } catch (e) {
            console.warn('Reverse geocoding failed:', e);
        }
        
        return position;
    } catch (error) {
        throw error;
    }
}

// === Calculate Distance Between Two Points ===
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // Returns distance in kilometers
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

// === Format Distance ===
function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)} متر`;
    }
    return `${km.toFixed(2)} كم`;
}

// === Check if Location is Valid ===
function isValidLocation(location) {
    if (!location) return false;
    
    const { latitude, longitude } = location;
    
    // Check if coordinates are valid
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
    if (isNaN(latitude) || isNaN(longitude)) return false;
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;
    
    return true;
}

// === Create Location Object for Asset ===
async function createAssetLocation(assetId) {
    try {
        const position = await getLocationWithAddress();
        
        return {
            assetId,
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
            altitude: position.altitude,
            address: position.address || '',
            addressDetails: position.addressDetails || {},
            mapsLink: createGoogleMapsLink(position.latitude, position.longitude).standard,
            capturedAt: new Date().toISOString(),
            capturedBy: AUTH_STATE.currentUser?.id,
            capturedByName: AUTH_STATE.currentUser?.name
        };
    } catch (error) {
        console.error('Error creating asset location:', error);
        return null;
    }
}

// === Save Asset Location ===
async function saveAssetLocation(assetId, location) {
    if (!location) return null;
    
    const locationData = {
        id: `loc-${assetId}`,
        ...location,
        updatedAt: new Date().toISOString()
    };
    
    await dbPut('assetLocations', locationData);
    return locationData;
}

// === Get Asset Location ===
async function getAssetLocation(assetId) {
    return await dbGet('assetLocations', `loc-${assetId}`);
}

// === Location Status Indicator Component ===
function createLocationStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'locationStatusIndicator';
    indicator.className = 'fixed bottom-20 left-4 z-50 bg-white rounded-full shadow-lg p-3 cursor-pointer transition-all hover:scale-110';
    
    indicator.innerHTML = `
        <div class="flex items-center gap-2">
            <div id="locationStatusIcon" class="w-3 h-3 rounded-full bg-gray-400"></div>
            <i class="fas fa-map-marker-alt text-gray-600"></i>
        </div>
    `;
    
    indicator.onclick = () => showLocationDetails();
    
    document.body.appendChild(indicator);
    
    // Update indicator status
    updateLocationIndicator();
}

function updateLocationIndicator() {
    const icon = document.getElementById('locationStatusIcon');
    if (!icon) return;
    
    if (GEO_STATE.error) {
        icon.className = 'w-3 h-3 rounded-full bg-red-500';
    } else if (GEO_STATE.currentPosition) {
        icon.className = 'w-3 h-3 rounded-full bg-green-500';
    } else {
        icon.className = 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse';
    }
}

function showLocationDetails() {
    const pos = GEO_STATE.currentPosition;
    
    if (!pos) {
        showToast('جاري تحديد الموقع...', 'info');
        getPosition().then(() => {
            updateLocationIndicator();
            showLocationDetails();
        }).catch(() => {
            showToast(GEO_STATE.error || 'فشل تحديد الموقع', 'error');
        });
        return;
    }
    
    const mapsLinks = createGoogleMapsLink(pos.latitude, pos.longitude);
    
    const modalContent = `
        <div class="text-center">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-map-marker-alt text-3xl text-blue-600"></i>
            </div>
            <h3 class="text-lg font-bold mb-4">موقعك الحالي</h3>
            
            <div class="bg-gray-50 rounded-lg p-4 mb-4 text-right">
                <div class="flex justify-between mb-2">
                    <span class="text-gray-600">خط العرض:</span>
                    <span class="font-mono">${pos.latitude.toFixed(6)}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span class="text-gray-600">خط الطول:</span>
                    <span class="font-mono">${pos.longitude.toFixed(6)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">الدقة:</span>
                    <span>${Math.round(pos.accuracy)} متر</span>
                </div>
            </div>
            
            <div class="flex gap-2 justify-center">
                <a href="${mapsLinks.standard}" target="_blank" 
                   class="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                    <i class="fas fa-external-link-alt"></i>
                    فتح في الخريطة
                </a>
                <button onclick="copyToClipboard('${pos.latitude},${pos.longitude}')"
                        class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200">
                    <i class="fas fa-copy"></i>
                    نسخ
                </button>
            </div>
        </div>
    `;
    
    showModal('تفاصيل الموقع', modalContent);
}

// === Copy to Clipboard ===
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('تم نسخ الإحداثيات', 'success');
    }).catch(() => {
        showToast('فشل النسخ', 'error');
    });
}

// === Export for global access ===
window.GEO_STATE = GEO_STATE;
window.initializeGeolocation = initializeGeolocation;
window.getPosition = getPosition;
window.startTracking = startTracking;
window.stopTracking = stopTracking;
window.createGoogleMapsLink = createGoogleMapsLink;
window.getLocationWithAddress = getLocationWithAddress;
window.calculateDistance = calculateDistance;
window.formatDistance = formatDistance;
window.isValidLocation = isValidLocation;
window.createAssetLocation = createAssetLocation;
window.saveAssetLocation = saveAssetLocation;
window.getAssetLocation = getAssetLocation;
window.createLocationStatusIndicator = createLocationStatusIndicator;
window.updateLocationIndicator = updateLocationIndicator;
window.copyToClipboard = copyToClipboard;
