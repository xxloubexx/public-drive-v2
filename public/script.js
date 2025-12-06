// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const uploadFileName = document.getElementById('uploadFileName');
const uploadPercent = document.getElementById('uploadPercent');
const progressFill = document.getElementById('progressFill');
const filesContainer = document.getElementById('filesContainer');
const emptyState = document.getElementById('emptyState');
const filesGrid = document.getElementById('filesGrid');
const refreshBtn = document.getElementById('refreshBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const breadcrumb = document.getElementById('breadcrumb');

// Preview Modal
const previewModal = document.getElementById('previewModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const downloadBtn = document.getElementById('downloadBtn');
const closeModal = document.getElementById('closeModal');

// Folder Modal
const folderModal = document.getElementById('folderModal');
const folderModalBackdrop = document.getElementById('folderModalBackdrop');
const closeFolderModal = document.getElementById('closeFolderModal');
const cancelFolderBtn = document.getElementById('cancelFolderBtn');
const newFolderForm = document.getElementById('newFolderForm');
const folderNameInput = document.getElementById('folderName');

const toastContainer = document.getElementById('toastContainer');

// Current path state
let currentPath = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    loadFiles();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Drop zone events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Refresh button
    refreshBtn.addEventListener('click', loadFiles);

    // New folder button
    newFolderBtn.addEventListener('click', openFolderModal);

    // Preview Modal events
    closeModal.addEventListener('click', closePreviewModal);
    modalBackdrop.addEventListener('click', closePreviewModal);

    // Folder Modal events
    closeFolderModal.addEventListener('click', closeFolderModalFn);
    folderModalBackdrop.addEventListener('click', closeFolderModalFn);
    cancelFolderBtn.addEventListener('click', closeFolderModalFn);
    newFolderForm.addEventListener('submit', handleCreateFolder);

    // Escape key for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePreviewModal();
            closeFolderModalFn();
        }
    });
}

// Drag & Drop Handlers
function handleDragEnter(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
    fileInput.value = '';
}

// Upload File
async function uploadFile(file) {
    // Validate file type
    const allowedTypes = ['.txt', '.pdf'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('Seuls les fichiers .txt et .pdf sont autorisés', 'error');
        return;
    }

    // Show progress
    uploadProgress.hidden = false;
    uploadFileName.textContent = file.name;
    uploadPercent.textContent = '0%';
    progressFill.style.width = '0%';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', currentPath);

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                uploadPercent.textContent = percent + '%';
                progressFill.style.width = percent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showToast('Fichier uploadé avec succès !', 'success');
                loadFiles();
            } else {
                const response = JSON.parse(xhr.responseText);
                showToast(response.error || 'Erreur lors de l\'upload', 'error');
            }
            setTimeout(() => {
                uploadProgress.hidden = true;
            }, 1000);
        });

        xhr.addEventListener('error', () => {
            showToast('Erreur de connexion', 'error');
            uploadProgress.hidden = true;
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);

    } catch (error) {
        showToast('Erreur lors de l\'upload', 'error');
        uploadProgress.hidden = true;
    }
}

// Load Files
async function loadFiles() {
    emptyState.hidden = true;
    filesGrid.innerHTML = '';

    try {
        const response = await fetch(`/files?path=${encodeURIComponent(currentPath)}`);
        const data = await response.json();
        updateBreadcrumb();

        if (data.items.length === 0) {
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
            data.items.forEach(item => {
                filesGrid.appendChild(createItemCard(item));
            });
        }
    } catch (error) {
        showToast('Erreur lors du chargement des fichiers', 'error');
    }
}

// Update Breadcrumb
function updateBreadcrumb() {
    breadcrumb.innerHTML = '';

    // Root item
    const rootItem = document.createElement('a');
    rootItem.href = '#';
    rootItem.className = 'breadcrumb-item' + (currentPath === '' ? ' active' : '');
    rootItem.dataset.path = '';
    rootItem.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
        Racine
    `;
    rootItem.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('');
    });
    breadcrumb.appendChild(rootItem);

    // Path segments
    if (currentPath) {
        const segments = currentPath.split('/').filter(s => s);
        let pathSoFar = '';

        segments.forEach((segment, index) => {
            // Separator
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            breadcrumb.appendChild(separator);

            // Segment link
            pathSoFar += (pathSoFar ? '/' : '') + segment;
            const segmentPath = pathSoFar;

            const segmentItem = document.createElement('a');
            segmentItem.href = '#';
            segmentItem.className = 'breadcrumb-item' + (index === segments.length - 1 ? ' active' : '');
            segmentItem.dataset.path = segmentPath;
            segmentItem.textContent = segment;
            segmentItem.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(segmentPath);
            });
            breadcrumb.appendChild(segmentItem);
        });
    }
}

// Navigate to folder
function navigateTo(path) {
    currentPath = path;
    loadFiles();
}

// Create Item Card (file or folder)
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'file-card' + (item.isDirectory ? ' folder' : '');

    let iconClass, iconSvg;

    if (item.isDirectory) {
        iconClass = 'folder';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>`;
    } else if (item.extension === '.pdf') {
        iconClass = 'pdf';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <path d="M9 15h6"/>
            <path d="M9 11h6"/>
        </svg>`;
    } else {
        iconClass = 'txt';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
        </svg>`;
    }

    const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;

    card.innerHTML = `
        <div class="file-card-content">
            <div class="file-header">
                <div class="file-icon ${iconClass}">
                    ${iconSvg}
                </div>
                <div class="file-info">
                    <div class="file-name" title="${item.name}">${item.name}</div>
                    <div class="file-meta">
                        ${item.isDirectory ? '<span>Dossier</span>' : `<span>${formatFileSize(item.size)}</span>`}
                        <span>${formatDate(item.modifiedAt)}</span>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                ${!item.isDirectory ? `
                    <a href="/files/${encodeURIComponent(itemPath)}" class="file-action-btn" title="Télécharger" onclick="event.stopPropagation()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </a>
                ` : ''}
                <button class="file-action-btn delete" title="Supprimer" onclick="event.stopPropagation(); deleteItem('${itemPath}', ${item.isDirectory})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    if (item.isDirectory) {
        card.addEventListener('click', () => navigateTo(itemPath));
    } else {
        card.addEventListener('click', () => previewFile(item, itemPath));
    }

    return card;
}

// Preview File
async function previewFile(file, filePath) {
    modalTitle.textContent = file.name;
    downloadBtn.href = `/files/${encodeURIComponent(filePath)}`;

    const isPdf = file.extension === '.pdf';

    if (isPdf) {
        modalBody.innerHTML = `<iframe class="pdf-preview" src="/files/${encodeURIComponent(filePath)}?view=true"></iframe>`;
    } else {
        modalBody.innerHTML = '<div class="text-preview">Chargement...</div>';

        try {
            const response = await fetch(`/files/${encodeURIComponent(filePath)}?view=true`);
            const text = await response.text();
            modalBody.innerHTML = `<pre class="text-preview">${escapeHtml(text)}</pre>`;
        } catch (error) {
            modalBody.innerHTML = '<div class="text-preview">Erreur lors du chargement du fichier</div>';
        }
    }

    previewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Preview Modal
function closePreviewModal() {
    previewModal.classList.remove('active');
    document.body.style.overflow = '';
    modalBody.innerHTML = '';
}

// Folder Modal
function openFolderModal() {
    folderNameInput.value = '';
    folderModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => folderNameInput.focus(), 100);
}

function closeFolderModalFn() {
    folderModal.classList.remove('active');
    document.body.style.overflow = '';
}

async function handleCreateFolder(e) {
    e.preventDefault();

    const name = folderNameInput.value.trim();
    if (!name) return;

    try {
        const response = await fetch('/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentPath, name: name })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Dossier créé avec succès', 'success');
            closeFolderModalFn();
            loadFiles();
        } else {
            showToast(result.error || 'Erreur lors de la création', 'error');
        }
    } catch (error) {
        showToast('Erreur lors de la création du dossier', 'error');
    }
}

// Delete Item (file or folder)
async function deleteItem(itemPath, isDirectory) {
    const itemType = isDirectory ? 'ce dossier' : 'ce fichier';
    const warning = isDirectory ? '\n\n⚠️ Tout le contenu du dossier sera supprimé !' : '';

    if (!confirm(`Voulez-vous vraiment supprimer ${itemType} ?${warning}`)) {
        return;
    }

    try {
        const response = await fetch(`/files/${encodeURIComponent(itemPath)}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Supprimé avec succès', 'success');
            loadFiles();
        } else {
            showToast(result.error || 'Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        showToast('Erreur lors de la suppression', 'error');
    }
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22,4 12,14.01 9,11.01"/>
        </svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-message">${message}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
