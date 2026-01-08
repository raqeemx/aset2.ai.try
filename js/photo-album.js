/**
 * Photo Album Module
 * نظام ألبوم الصور للأصول
 * Version 6.0
 */

// === Photo Album State ===
const PHOTO_STATE = {
    maxPhotosPerAsset: 10,
    maxPhotoSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    compressionQuality: 0.8,
    thumbnailSize: 200
};

// === Initialize Photo Album System ===
function initializePhotoAlbum() {
    console.log('Photo album system initialized');
}

// === Capture Photo from Camera ===
async function capturePhoto() {
    return new Promise((resolve, reject) => {
        // Create hidden input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use back camera on mobile
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                reject(new Error('لم يتم اختيار صورة'));
                return;
            }
            
            try {
                const processedImage = await processImage(file);
                resolve(processedImage);
            } catch (error) {
                reject(error);
            }
        };
        
        input.click();
    });
}

// === Select Photos from Gallery ===
async function selectPhotos(multiple = true) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = multiple;
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) {
                reject(new Error('لم يتم اختيار صور'));
                return;
            }
            
            try {
                const processedImages = [];
                for (const file of files) {
                    const processed = await processImage(file);
                    processedImages.push(processed);
                }
                resolve(processedImages);
            } catch (error) {
                reject(error);
            }
        };
        
        input.click();
    });
}

// === Process Image (Resize & Compress) ===
async function processImage(file) {
    return new Promise((resolve, reject) => {
        // Validate file type
        if (!PHOTO_STATE.allowedTypes.includes(file.type)) {
            reject(new Error('نوع الملف غير مدعوم'));
            return;
        }
        
        // Validate file size
        if (file.size > PHOTO_STATE.maxPhotoSize) {
            reject(new Error('حجم الصورة كبير جداً (الحد الأقصى 5MB)'));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Create canvas for resizing
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1920px width/height)
                const maxSize = 1920;
                let width = img.width;
                let height = img.height;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed data URL
                const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_STATE.compressionQuality);
                
                // Create thumbnail
                const thumbCanvas = document.createElement('canvas');
                const thumbCtx = thumbCanvas.getContext('2d');
                const thumbSize = PHOTO_STATE.thumbnailSize;
                
                // Square thumbnail
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                
                thumbCanvas.width = thumbSize;
                thumbCanvas.height = thumbSize;
                thumbCtx.drawImage(img, sx, sy, size, size, 0, 0, thumbSize, thumbSize);
                
                const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);
                
                resolve({
                    id: generatePhotoId(),
                    dataUrl,
                    thumbnail,
                    width,
                    height,
                    originalName: file.name,
                    size: Math.round(dataUrl.length * 0.75), // Approximate size
                    mimeType: 'image/jpeg',
                    capturedAt: new Date().toISOString(),
                    capturedBy: AUTH_STATE.currentUser?.id,
                    capturedByName: AUTH_STATE.currentUser?.name
                });
            };
            
            img.onerror = () => reject(new Error('فشل تحميل الصورة'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('فشل قراءة الملف'));
        reader.readAsDataURL(file);
    });
}

// === Generate Photo ID ===
function generatePhotoId() {
    return `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// === Create Photo Album for Asset ===
async function createPhotoAlbum(assetId, photos = []) {
    const album = {
        id: `album-${assetId}`,
        assetId,
        photos: photos.map((photo, index) => ({
            ...photo,
            order: index
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    await dbPut('photoAlbums', album);
    return album;
}

// === Get Photo Album ===
async function getPhotoAlbum(assetId) {
    return await dbGet('photoAlbums', `album-${assetId}`);
}

// === Add Photo to Album ===
async function addPhotoToAlbum(assetId, photo) {
    let album = await getPhotoAlbum(assetId);
    
    if (!album) {
        album = await createPhotoAlbum(assetId, [photo]);
    } else {
        if (album.photos.length >= PHOTO_STATE.maxPhotosPerAsset) {
            throw new Error(`لا يمكن إضافة أكثر من ${PHOTO_STATE.maxPhotosPerAsset} صور للأصل`);
        }
        
        album.photos.push({
            ...photo,
            order: album.photos.length
        });
        album.updatedAt = new Date().toISOString();
        
        await dbPut('photoAlbums', album);
    }
    
    return album;
}

// === Remove Photo from Album ===
async function removePhotoFromAlbum(assetId, photoId) {
    const album = await getPhotoAlbum(assetId);
    
    if (!album) {
        throw new Error('الألبوم غير موجود');
    }
    
    album.photos = album.photos.filter(p => p.id !== photoId);
    album.photos.forEach((photo, index) => {
        photo.order = index;
    });
    album.updatedAt = new Date().toISOString();
    
    await dbPut('photoAlbums', album);
    return album;
}

// === Reorder Photos in Album ===
async function reorderPhotos(assetId, photoIds) {
    const album = await getPhotoAlbum(assetId);
    
    if (!album) {
        throw new Error('الألبوم غير موجود');
    }
    
    const reorderedPhotos = [];
    for (let i = 0; i < photoIds.length; i++) {
        const photo = album.photos.find(p => p.id === photoIds[i]);
        if (photo) {
            photo.order = i;
            reorderedPhotos.push(photo);
        }
    }
    
    album.photos = reorderedPhotos;
    album.updatedAt = new Date().toISOString();
    
    await dbPut('photoAlbums', album);
    return album;
}

// === Generate Album Viewer URL ===
function generateAlbumViewerUrl(assetId, assetName = '') {
    // Generate a shareable album URL
    const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
    const cleanAssetName = encodeURIComponent(assetName || assetId);
    return `${baseUrl}index.html?view=album&asset=${assetId}&name=${cleanAssetName}`;
}

// === Render Photo Gallery ===
function renderPhotoGallery(containerId, photos, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const {
        editable = false,
        onDelete = null,
        onReorder = null,
        showCaptions = true
    } = options;
    
    if (!photos || photos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-images text-4xl mb-2"></i>
                <p>لا توجد صور</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${photos.map((photo, index) => `
                <div class="photo-item relative group rounded-lg overflow-hidden shadow-md cursor-pointer" 
                     data-photo-id="${photo.id}"
                     onclick="openPhotoViewer('${photo.id}', ${JSON.stringify(photos.map(p => p.id)).replace(/"/g, '&quot;')})">
                    <img src="${photo.thumbnail || photo.dataUrl}" 
                         alt="صورة ${index + 1}"
                         class="w-full h-40 object-cover transition-transform group-hover:scale-110">
                    
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all"></div>
                    
                    ${editable ? `
                        <button onclick="event.stopPropagation(); deletePhoto('${photo.id}')"
                                class="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full 
                                       opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                    ` : ''}
                    
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <span class="text-white text-xs">${index + 1}/${photos.length}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// === Open Photo Viewer (Lightbox) ===
function openPhotoViewer(photoId, allPhotoIds) {
    // Get all photos data
    const photos = allPhotoIds.map(id => {
        const elem = document.querySelector(`[data-photo-id="${id}"]`);
        return elem ? { id } : null;
    }).filter(p => p);
    
    const currentIndex = allPhotoIds.indexOf(photoId);
    
    // Create lightbox
    const lightbox = document.createElement('div');
    lightbox.id = 'photoLightbox';
    lightbox.className = 'fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center';
    
    lightbox.innerHTML = `
        <div class="absolute top-4 right-4 z-10">
            <button onclick="closeLightbox()" class="text-white text-2xl p-2 hover:bg-white/10 rounded-full">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="absolute top-4 left-4 z-10 text-white">
            <span id="lightboxCounter">${currentIndex + 1} / ${allPhotoIds.length}</span>
        </div>
        
        <button onclick="lightboxPrev()" 
                class="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl p-4 hover:bg-white/10 rounded-full ${currentIndex === 0 ? 'opacity-30' : ''}">
            <i class="fas fa-chevron-left"></i>
        </button>
        
        <button onclick="lightboxNext()" 
                class="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl p-4 hover:bg-white/10 rounded-full ${currentIndex === allPhotoIds.length - 1 ? 'opacity-30' : ''}">
            <i class="fas fa-chevron-right"></i>
        </button>
        
        <div id="lightboxImageContainer" class="max-w-full max-h-full p-4">
            <img id="lightboxImage" src="" alt="" class="max-w-full max-h-[85vh] object-contain">
        </div>
        
        <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            <button onclick="downloadCurrentPhoto()" class="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20">
                <i class="fas fa-download ml-2"></i>
                تحميل
            </button>
            <button onclick="shareCurrentPhoto()" class="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20">
                <i class="fas fa-share-alt ml-2"></i>
                مشاركة
            </button>
        </div>
    `;
    
    document.body.appendChild(lightbox);
    document.body.style.overflow = 'hidden';
    
    // Store state
    window.lightboxState = {
        photos: allPhotoIds,
        currentIndex,
        getPhotoSrc: (id) => {
            const img = document.querySelector(`[data-photo-id="${id}"] img`);
            return img ? img.src.replace('/thumbnail/', '/') : '';
        }
    };
    
    // Load current image
    updateLightboxImage();
    
    // Keyboard navigation
    document.addEventListener('keydown', lightboxKeyHandler);
}

function updateLightboxImage() {
    const state = window.lightboxState;
    if (!state) return;
    
    const currentId = state.photos[state.currentIndex];
    const img = document.getElementById('lightboxImage');
    const counter = document.getElementById('lightboxCounter');
    
    // Try to get full image from photo album state or fallback to thumbnail
    const photoElem = document.querySelector(`[data-photo-id="${currentId}"] img`);
    if (img && photoElem) {
        // For now, use the same source; in production, this would fetch full-size
        img.src = photoElem.src;
    }
    
    if (counter) {
        counter.textContent = `${state.currentIndex + 1} / ${state.photos.length}`;
    }
}

function lightboxPrev() {
    const state = window.lightboxState;
    if (!state || state.currentIndex <= 0) return;
    
    state.currentIndex--;
    updateLightboxImage();
}

function lightboxNext() {
    const state = window.lightboxState;
    if (!state || state.currentIndex >= state.photos.length - 1) return;
    
    state.currentIndex++;
    updateLightboxImage();
}

function closeLightbox() {
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) {
        lightbox.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', lightboxKeyHandler);
        window.lightboxState = null;
    }
}

function lightboxKeyHandler(e) {
    switch (e.key) {
        case 'ArrowLeft':
            lightboxNext(); // RTL
            break;
        case 'ArrowRight':
            lightboxPrev(); // RTL
            break;
        case 'Escape':
            closeLightbox();
            break;
    }
}

function downloadCurrentPhoto() {
    const img = document.getElementById('lightboxImage');
    if (!img || !img.src) return;
    
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `photo-${Date.now()}.jpg`;
    link.click();
}

async function shareCurrentPhoto() {
    const img = document.getElementById('lightboxImage');
    if (!img || !img.src) return;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'صورة من نظام جرد الأصول',
                text: 'صورة أصل',
                url: img.src
            });
        } catch (e) {
            console.log('Share cancelled');
        }
    } else {
        // Copy URL to clipboard
        copyToClipboard(img.src);
        showToast('تم نسخ رابط الصورة', 'success');
    }
}

// === Create Photo Upload Widget ===
function createPhotoUploadWidget(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const {
        maxPhotos = PHOTO_STATE.maxPhotosPerAsset,
        onPhotosChange = null,
        initialPhotos = []
    } = options;
    
    let photos = [...initialPhotos];
    
    container.innerHTML = `
        <div class="photo-upload-widget">
            <div id="photoPreviewGrid" class="grid grid-cols-3 gap-2 mb-4"></div>
            
            <div class="flex gap-2">
                <button type="button" onclick="widgetCapturePhoto('${containerId}')"
                        class="flex-1 bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700">
                    <i class="fas fa-camera"></i>
                    التقاط صورة
                </button>
                <button type="button" onclick="widgetSelectPhotos('${containerId}')"
                        class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200">
                    <i class="fas fa-images"></i>
                    اختيار من المعرض
                </button>
            </div>
            
            <p class="text-xs text-gray-500 mt-2 text-center">
                الحد الأقصى ${maxPhotos} صور • كل صورة حتى 5MB
            </p>
        </div>
    `;
    
    // Store widget state
    container._photoWidget = {
        photos,
        maxPhotos,
        onPhotosChange,
        updatePreview: () => renderWidgetPreview(containerId)
    };
    
    renderWidgetPreview(containerId);
}

function renderWidgetPreview(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._photoWidget) return;
    
    const { photos, maxPhotos } = container._photoWidget;
    const grid = container.querySelector('#photoPreviewGrid');
    
    if (!grid) return;
    
    grid.innerHTML = photos.map((photo, index) => `
        <div class="relative group">
            <img src="${photo.thumbnail || photo.dataUrl}" 
                 alt="صورة ${index + 1}"
                 class="w-full h-24 object-cover rounded-lg">
            <button type="button" 
                    onclick="widgetRemovePhoto('${containerId}', ${index})"
                    class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full 
                           opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>
    `).join('');
    
    // Add empty slots
    const emptySlots = Math.min(3 - photos.length, maxPhotos - photos.length);
    for (let i = 0; i < emptySlots; i++) {
        grid.innerHTML += `
            <div class="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg 
                        flex items-center justify-center text-gray-400">
                <i class="fas fa-plus"></i>
            </div>
        `;
    }
}

async function widgetCapturePhoto(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._photoWidget) return;
    
    const widget = container._photoWidget;
    
    if (widget.photos.length >= widget.maxPhotos) {
        showToast(`الحد الأقصى ${widget.maxPhotos} صور`, 'warning');
        return;
    }
    
    try {
        const photo = await capturePhoto();
        widget.photos.push(photo);
        widget.updatePreview();
        
        if (widget.onPhotosChange) {
            widget.onPhotosChange(widget.photos);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function widgetSelectPhotos(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._photoWidget) return;
    
    const widget = container._photoWidget;
    const remaining = widget.maxPhotos - widget.photos.length;
    
    if (remaining <= 0) {
        showToast(`الحد الأقصى ${widget.maxPhotos} صور`, 'warning');
        return;
    }
    
    try {
        const photos = await selectPhotos(true);
        const toAdd = photos.slice(0, remaining);
        widget.photos.push(...toAdd);
        widget.updatePreview();
        
        if (widget.onPhotosChange) {
            widget.onPhotosChange(widget.photos);
        }
        
        if (photos.length > remaining) {
            showToast(`تم إضافة ${toAdd.length} صور فقط (الحد الأقصى ${widget.maxPhotos})`, 'info');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function widgetRemovePhoto(containerId, index) {
    const container = document.getElementById(containerId);
    if (!container || !container._photoWidget) return;
    
    const widget = container._photoWidget;
    widget.photos.splice(index, 1);
    widget.updatePreview();
    
    if (widget.onPhotosChange) {
        widget.onPhotosChange(widget.photos);
    }
}

function getWidgetPhotos(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._photoWidget) return [];
    
    return container._photoWidget.photos;
}

// === Handle Album URL Parameters ===
async function handleAlbumUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    const assetId = urlParams.get('asset');
    const assetName = urlParams.get('name');
    
    if (view === 'album' && assetId) {
        // Wait for database to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            // Try to get asset from IndexedDB
            const asset = await dbGet('assets', assetId);
            
            if (asset && asset.images && asset.images.length > 0) {
                showAlbumFullscreen(asset, assetName);
            } else {
                // Show message that asset not found or has no photos
                showAlbumNotFoundMessage(assetName);
            }
        } catch (error) {
            console.error('Error loading album:', error);
            showAlbumNotFoundMessage(assetName);
        }
    }
}

// === Show Album in Fullscreen Mode ===
function showAlbumFullscreen(asset, assetName) {
    const albumHtml = `
        <div id="albumViewerOverlay" class="fixed inset-0 bg-black z-[9999] flex flex-col">
            <div class="bg-gradient-to-r from-gov-blue to-gov-blue-light text-white p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <i class="fas fa-images text-2xl"></i>
                    <div>
                        <h2 class="text-lg font-bold">${decodeURIComponent(assetName || asset.name || 'ألبوم الصور')}</h2>
                        <p class="text-sm opacity-80">${asset.images.length} صورة • ${asset.code || ''}</p>
                    </div>
                </div>
                <button onclick="closeAlbumViewer()" class="hover:bg-white/20 p-2 rounded-lg transition-colors">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="flex-1 overflow-auto p-4">
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    ${asset.images.map((img, index) => `
                        <div class="bg-gray-800 rounded-xl overflow-hidden shadow-lg cursor-pointer transform hover:scale-105 transition-transform"
                             onclick="openFullImage('${img.dataUrl || img}', ${index}, ${asset.images.length})">
                            <img src="${img.thumbnail || img.dataUrl || img}" 
                                 alt="صورة ${index + 1}"
                                 class="w-full h-48 object-cover">
                            <div class="p-2 text-center text-white text-sm">
                                صورة ${index + 1} من ${asset.images.length}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="bg-gray-900 text-white p-4 text-center">
                <p class="text-sm opacity-70">
                    <i class="fas fa-info-circle ml-1"></i>
                    اضغط على أي صورة لعرضها بالحجم الكامل
                </p>
            </div>
        </div>
    `;
    
    // Create overlay container
    const container = document.createElement('div');
    container.innerHTML = albumHtml;
    document.body.appendChild(container.firstElementChild);
}

// === Show Album Not Found Message ===
function showAlbumNotFoundMessage(assetName) {
    const messageHtml = `
        <div id="albumViewerOverlay" class="fixed inset-0 bg-gray-100 z-[9999] flex items-center justify-center">
            <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-image text-4xl text-gray-400"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">
                    لا توجد صور متاحة
                </h3>
                <p class="text-gray-600 mb-6">
                    ${assetName ? `الأصل "${decodeURIComponent(assetName)}" ليس لديه صور حالياً أو أنه غير موجود في قاعدة البيانات المحلية.` : 'لم يتم العثور على الأصل المطلوب.'}
                </p>
                <button onclick="closeAlbumViewer()" class="bg-gov-blue text-white px-6 py-2 rounded-xl hover:bg-gov-blue-light transition-colors">
                    <i class="fas fa-arrow-right ml-2"></i>
                    العودة
                </button>
            </div>
        </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = messageHtml;
    document.body.appendChild(container.firstElementChild);
}

// === Open Full Image ===
function openFullImage(imageUrl, currentIndex, totalImages) {
    const fullImageHtml = `
        <div id="fullImageViewer" class="fixed inset-0 bg-black z-[10000] flex flex-col" onclick="closeFullImage(event)">
            <div class="p-4 text-white text-center">
                صورة ${currentIndex + 1} من ${totalImages}
            </div>
            <div class="flex-1 flex items-center justify-center p-4">
                <img src="${imageUrl}" alt="صورة" class="max-w-full max-h-full object-contain" onclick="event.stopPropagation()">
            </div>
            <div class="p-4 text-center">
                <button onclick="closeFullImage(event)" class="bg-white/20 text-white px-6 py-2 rounded-xl hover:bg-white/30">
                    <i class="fas fa-times ml-2"></i>
                    إغلاق
                </button>
            </div>
        </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = fullImageHtml;
    document.body.appendChild(container.firstElementChild);
}

// === Close Album Viewer ===
function closeAlbumViewer() {
    const overlay = document.getElementById('albumViewerOverlay');
    if (overlay) {
        overlay.remove();
    }
    // Clear URL params and redirect to main page
    window.history.replaceState({}, '', 'index.html');
}

// === Close Full Image ===
function closeFullImage(event) {
    if (event) event.stopPropagation();
    const viewer = document.getElementById('fullImageViewer');
    if (viewer) {
        viewer.remove();
    }
}

// === Initialize on page load ===
document.addEventListener('DOMContentLoaded', function() {
    // Check for album view parameters after a short delay
    setTimeout(handleAlbumUrlParams, 500);
});

// === Export for global access ===
window.PHOTO_STATE = PHOTO_STATE;
window.initializePhotoAlbum = initializePhotoAlbum;
window.capturePhoto = capturePhoto;
window.selectPhotos = selectPhotos;
window.processImage = processImage;
window.createPhotoAlbum = createPhotoAlbum;
window.getPhotoAlbum = getPhotoAlbum;
window.addPhotoToAlbum = addPhotoToAlbum;
window.removePhotoFromAlbum = removePhotoFromAlbum;
window.reorderPhotos = reorderPhotos;
window.generateAlbumViewerUrl = generateAlbumViewerUrl;
window.renderPhotoGallery = renderPhotoGallery;
window.openPhotoViewer = openPhotoViewer;
window.closeLightbox = closeLightbox;
window.createPhotoUploadWidget = createPhotoUploadWidget;
window.widgetCapturePhoto = widgetCapturePhoto;
window.widgetSelectPhotos = widgetSelectPhotos;
window.widgetRemovePhoto = widgetRemovePhoto;
window.getWidgetPhotos = getWidgetPhotos;
window.handleAlbumUrlParams = handleAlbumUrlParams;
window.closeAlbumViewer = closeAlbumViewer;
window.closeFullImage = closeFullImage;
window.openFullImage = openFullImage;
