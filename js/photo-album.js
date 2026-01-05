/**
 * Photo Album Manager
 * نظام إدارة ألبوم الصور للأصول مع Firebase Storage
 */

// Photo Album State
const PHOTO_ALBUM_STATE = {
    currentAlbum: [],
    uploadQueue: [],
    isUploading: false
};

// Supported image types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const THUMBNAIL_SIZE = 200;

/**
 * Initialize Photo Album Manager
 */
function initPhotoAlbumManager() {
    setupImageUploadListeners();
    setupDragAndDrop();
}

/**
 * Setup image upload listeners
 */
function setupImageUploadListeners() {
    const fileInputs = document.querySelectorAll('.photo-upload-input');
    fileInputs.forEach(input => {
        input.addEventListener('change', handleFileSelect);
    });
}

/**
 * Setup drag and drop for images
 */
function setupDragAndDrop() {
    const dropZones = document.querySelectorAll('.photo-drop-zone');
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            handleFiles(files);
        });
    });
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

/**
 * Handle multiple files
 */
async function handleFiles(files) {
    const validFiles = [];
    
    for (const file of files) {
        // Validate file type
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
            showToast(`نوع الملف غير مدعوم: ${file.name}`, 'error');
            continue;
        }
        
        // Validate file size
        if (file.size > MAX_IMAGE_SIZE) {
            showToast(`حجم الملف كبير جداً: ${file.name}`, 'error');
            continue;
        }
        
        validFiles.push(file);
    }

    if (validFiles.length > 0) {
        await processImages(validFiles);
    }
}

/**
 * Process images for upload
 */
async function processImages(files) {
    showLoading();
    
    for (const file of files) {
        try {
            // Create preview
            const preview = await createImagePreview(file);
            
            // Compress image if needed
            const compressedBlob = await compressImage(file);
            
            // Create photo object
            const photo = {
                id: generateId(),
                originalName: file.name,
                type: file.type,
                size: compressedBlob.size,
                blob: compressedBlob,
                preview: preview,
                uploadStatus: 'pending',
                createdAt: new Date().toISOString()
            };
            
            APP_STATE.uploadedImages.push(photo);
            renderImagePreviews();
            
        } catch (error) {
            console.error('Error processing image:', error);
            showToast(`فشل معالجة الصورة: ${file.name}`, 'error');
        }
    }
    
    hideLoading();
}

/**
 * Create image preview as data URL
 */
function createImagePreview(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Compress image using canvas
 */
async function compressImage(file, maxWidth = 1920, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Scale down if needed
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => resolve(blob),
                'image/jpeg',
                quality
            );
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * Upload images to Firebase Storage
 */
async function uploadImagesToFirebase(assetId, images) {
    if (!isFirebaseReady()) {
        // Store locally if Firebase not available
        return await storeImagesLocally(assetId, images);
    }

    const { ref, uploadBytes, getDownloadURL } = window.FirebaseModules.storage;
    const uploadedImages = [];

    for (const image of images) {
        try {
            // Create storage reference
            const imagePath = `assets/${assetId}/${image.id}_${Date.now()}.jpg`;
            const storageRef = ref(getFirebaseStorage(), imagePath);

            // Upload image
            await uploadBytes(storageRef, image.blob);

            // Get download URL
            const downloadURL = await getDownloadURL(storageRef);

            uploadedImages.push({
                id: image.id,
                url: downloadURL,
                path: imagePath,
                name: image.originalName,
                size: image.size,
                uploadedAt: new Date().toISOString()
            });

            image.uploadStatus = 'uploaded';
            image.url = downloadURL;
            image.path = imagePath;

        } catch (error) {
            console.error('Upload error:', error);
            image.uploadStatus = 'failed';
            showToast(`فشل رفع الصورة: ${image.originalName}`, 'error');
        }
    }

    return uploadedImages;
}

/**
 * Store images locally when Firebase is unavailable
 */
async function storeImagesLocally(assetId, images) {
    const storedImages = [];

    for (const image of images) {
        try {
            // Convert blob to base64 for storage
            const base64 = await blobToBase64(image.blob);
            
            const storedImage = {
                id: image.id,
                assetId: assetId,
                base64: base64,
                name: image.originalName,
                size: image.size,
                type: image.type,
                storedLocally: true,
                createdAt: new Date().toISOString()
            };

            // Store in IndexedDB
            await dbPut('assetPhotos', storedImage);
            storedImages.push(storedImage);

            // Queue for upload when online
            await queueForSync('create', 'assetPhotos', storedImage);

        } catch (error) {
            console.error('Error storing image locally:', error);
        }
    }

    return storedImages;
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Delete image from Firebase Storage
 */
async function deleteImageFromFirebase(imagePath) {
    if (!isFirebaseReady()) {
        showToast('لا يمكن الحذف بدون اتصال', 'warning');
        return false;
    }

    try {
        const { ref, deleteObject } = window.FirebaseModules.storage;
        const imageRef = ref(getFirebaseStorage(), imagePath);
        await deleteObject(imageRef);
        return true;
    } catch (error) {
        console.error('Delete error:', error);
        return false;
    }
}

/**
 * Render image previews in the upload area
 */
function renderImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    if (!container) return;

    if (APP_STATE.uploadedImages.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = APP_STATE.uploadedImages.map((image, index) => `
        <div class="relative group" data-image-id="${image.id}">
            <img src="${image.preview || image.url}" 
                 alt="صورة ${index + 1}" 
                 class="w-24 h-24 object-cover rounded-lg border-2 ${
                     image.uploadStatus === 'uploaded' ? 'border-green-500' :
                     image.uploadStatus === 'failed' ? 'border-red-500' :
                     'border-gray-300'
                 }">
            <button onclick="removeUploadedImage('${image.id}')"
                    class="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full 
                           opacity-0 group-hover:opacity-100 transition-opacity text-sm">
                <i class="fas fa-times"></i>
            </button>
            ${image.uploadStatus === 'pending' ? `
                <div class="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <i class="fas fa-spinner fa-spin text-white"></i>
                </div>
            ` : ''}
            ${image.uploadStatus === 'uploaded' ? `
                <div class="absolute bottom-1 right-1 bg-green-500 text-white text-xs px-1 rounded">
                    <i class="fas fa-check"></i>
                </div>
            ` : ''}
        </div>
    `).join('');
}

/**
 * Remove uploaded image from list
 */
function removeUploadedImage(imageId) {
    const index = APP_STATE.uploadedImages.findIndex(img => img.id === imageId);
    if (index > -1) {
        APP_STATE.uploadedImages.splice(index, 1);
        renderImagePreviews();
    }
}

/**
 * Clear all uploaded images
 */
function clearUploadedImages() {
    APP_STATE.uploadedImages = [];
    renderImagePreviews();
}

/**
 * Get album for an asset
 */
async function getAssetAlbum(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset) return [];

    return asset.images || [];
}

/**
 * Generate album link for asset
 */
function generateAlbumLink(assetId) {
    // This would be a link to view all photos for this asset
    return `${window.location.origin}${window.location.pathname}#album/${assetId}`;
}

/**
 * Render photo album modal
 */
function showPhotoAlbum(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset || !asset.images || asset.images.length === 0) {
        showToast('لا توجد صور لهذا الأصل', 'info');
        return;
    }

    const modalContent = `
        <div class="p-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold">صور ${asset.name}</h3>
                <span class="text-sm text-gray-500">${asset.images.length} صورة</span>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                ${asset.images.map((img, index) => `
                    <div class="relative aspect-square cursor-pointer" onclick="showFullImage('${img.url}')">
                        <img src="${img.url}" 
                             alt="صورة ${index + 1}" 
                             class="w-full h-full object-cover rounded-lg shadow">
                        <div class="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors rounded-lg
                                    flex items-center justify-center opacity-0 hover:opacity-100">
                            <i class="fas fa-search-plus text-white text-2xl"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-4 text-center">
                <button onclick="downloadAllPhotos('${assetId}')" 
                        class="bg-gov-blue text-white px-4 py-2 rounded-lg hover:bg-gov-blue-light">
                    <i class="fas fa-download ml-2"></i> تحميل جميع الصور
                </button>
            </div>
        </div>
    `;

    showCustomModal('ألبوم الصور', modalContent);
}

/**
 * Show full size image
 */
function showFullImage(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <button class="absolute top-4 left-4 text-white text-2xl hover:text-gray-300"
                onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <img src="${imageUrl}" alt="صورة" class="max-w-full max-h-full object-contain">
        <a href="${imageUrl}" download class="absolute bottom-4 left-4 text-white hover:text-gray-300">
            <i class="fas fa-download text-xl"></i>
        </a>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
}

/**
 * Download all photos for an asset
 */
async function downloadAllPhotos(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset || !asset.images) return;

    showToast('جاري تجهيز الصور للتحميل...', 'info');

    // Download each image
    for (let i = 0; i < asset.images.length; i++) {
        const img = asset.images[i];
        try {
            const response = await fetch(img.url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${asset.name}_photo_${i + 1}.jpg`;
            a.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    }

    showToast('تم تحميل الصور', 'success');
}

/**
 * Take photo using camera
 */
async function capturePhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        // Create video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        // Create capture modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black z-50 flex flex-col items-center justify-center';
        modal.innerHTML = `
            <video autoplay playsinline class="max-w-full max-h-[70vh]"></video>
            <div class="mt-4 flex gap-4">
                <button id="captureBtn" class="bg-white text-black px-6 py-3 rounded-full text-lg">
                    <i class="fas fa-camera"></i> التقاط
                </button>
                <button id="cancelCaptureBtn" class="bg-red-500 text-white px-6 py-3 rounded-full text-lg">
                    <i class="fas fa-times"></i> إلغاء
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.querySelector('video').srcObject = stream;
        
        // Handle capture
        modal.querySelector('#captureBtn').onclick = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            canvas.toBlob(async (blob) => {
                const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                await handleFiles([file]);
            }, 'image/jpeg', 0.9);
            
            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            modal.remove();
        };
        
        // Handle cancel
        modal.querySelector('#cancelCaptureBtn').onclick = () => {
            stream.getTracks().forEach(track => track.stop());
            modal.remove();
        };
        
    } catch (error) {
        console.error('Camera error:', error);
        showToast('فشل الوصول للكاميرا', 'error');
    }
}

/**
 * Export Photo Album functions
 */
window.PhotoAlbum = {
    init: initPhotoAlbumManager,
    handleFiles,
    uploadToFirebase: uploadImagesToFirebase,
    deleteFromFirebase: deleteImageFromFirebase,
    getAlbum: getAssetAlbum,
    showAlbum: showPhotoAlbum,
    capturePhoto,
    clear: clearUploadedImages,
    generateAlbumLink
};
