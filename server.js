const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper: Validate and resolve path within uploads directory
function resolveSafePath(relativePath) {
    const normalized = path.normalize(relativePath || '').replace(/^(\.\.(\/|\\|$))+/, '');
    const resolved = path.join(uploadsDir, normalized);

    // Security: ensure path stays within uploads directory
    if (!resolved.startsWith(uploadsDir)) {
        return null;
    }
    return resolved;
}

// Use memory storage first, then save to correct folder
const memoryStorage = multer.memoryStorage();

// Filter to only allow .txt and .pdf files
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Seuls les fichiers .txt et .pdf sont autorisés'), false);
    }
};

const upload = multer({
    storage: memoryStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API: Upload file (with folder parameter)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier uploadé ou type non autorisé' });
    }

    // Get folder from body - now accessible after multer processes the request
    const folder = req.body.folder || '';
    const destPath = resolveSafePath(folder);

    if (!destPath) {
        return res.status(400).json({ error: 'Chemin invalide' });
    }

    // Create folder if it doesn't exist
    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
    }

    // Get original filename
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    let finalName = originalName;
    let filePath = path.join(destPath, originalName);

    // If file exists, add timestamp suffix
    if (fs.existsSync(filePath)) {
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const timestamp = Date.now();
        finalName = `${baseName}_${timestamp}${ext}`;
        filePath = path.join(destPath, finalName);
    }

    // Write file to disk
    try {
        fs.writeFileSync(filePath, req.file.buffer);

        res.json({
            success: true,
            message: 'Fichier uploadé avec succès',
            file: {
                name: finalName,
                originalName: originalName,
                size: req.file.size,
                type: mime.lookup(finalName) || 'application/octet-stream',
                folder: folder
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de l\'écriture du fichier' });
    }
});

// Error handler for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Le fichier est trop volumineux (max 50MB)' });
        }
        return res.status(400).json({ error: err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

// API: Create folder
app.post('/folders', (req, res) => {
    const { path: folderPath, name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Le nom du dossier est requis' });
    }

    // Validate folder name
    if (/[<>:"/\\|?*]/.test(name)) {
        return res.status(400).json({ error: 'Le nom du dossier contient des caractères invalides' });
    }

    const parentPath = resolveSafePath(folderPath || '');
    if (!parentPath) {
        return res.status(400).json({ error: 'Chemin parent invalide' });
    }

    const newFolderPath = path.join(parentPath, name.trim());

    // Security check
    if (!newFolderPath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Accès refusé' });
    }

    if (fs.existsSync(newFolderPath)) {
        return res.status(400).json({ error: 'Ce dossier existe déjà' });
    }

    try {
        fs.mkdirSync(newFolderPath, { recursive: true });
        res.json({ success: true, message: 'Dossier créé avec succès', name: name.trim() });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création du dossier' });
    }
});

// API: List files and folders in a directory
app.get('/files', (req, res) => {
    const folderPath = req.query.path || '';
    const dirPath = resolveSafePath(folderPath);

    if (!dirPath) {
        return res.status(400).json({ error: 'Chemin invalide' });
    }

    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    fs.readdir(dirPath, { withFileTypes: true }, (err, entries) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la lecture des fichiers' });
        }

        const items = entries.map(entry => {
            const itemPath = path.join(dirPath, entry.name);
            const stats = fs.statSync(itemPath);
            const isDirectory = entry.isDirectory();

            return {
                name: entry.name,
                isDirectory: isDirectory,
                size: isDirectory ? null : stats.size,
                type: isDirectory ? 'folder' : (mime.lookup(entry.name) || 'application/octet-stream'),
                extension: isDirectory ? null : path.extname(entry.name).toLowerCase(),
                modifiedAt: stats.mtime
            };
        });

        // Sort: folders first, then by modification date
        items.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return new Date(b.modifiedAt) - new Date(a.modifiedAt);
        });

        res.json({
            path: folderPath,
            items: items
        });
    });
});

// API: Get/Download a specific file
app.get('/files/*', (req, res) => {
    const filePath = req.params[0];
    const fullPath = resolveSafePath(filePath);

    if (!fullPath) {
        return res.status(400).json({ error: 'Chemin invalide' });
    }

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Ceci est un dossier, pas un fichier' });
    }

    const filename = path.basename(fullPath);
    const mimeType = mime.lookup(filename) || 'application/octet-stream';

    // For viewing in browser
    if (req.query.view === 'true') {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    } else {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.sendFile(fullPath);
});

// API: Delete a file or folder
app.delete('/files/*', (req, res) => {
    const itemPath = req.params[0];
    const fullPath = resolveSafePath(itemPath);

    if (!fullPath) {
        return res.status(400).json({ error: 'Chemin invalide' });
    }

    // Prevent deleting the root uploads directory
    if (fullPath === uploadsDir) {
        return res.status(403).json({ error: 'Impossible de supprimer le dossier racine' });
    }

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Fichier ou dossier non trouvé' });
    }

    try {
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true });
        } else {
            fs.unlinkSync(fullPath);
        }

        res.json({ success: true, message: 'Supprimé avec succès' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Public Drive démarré sur http://localhost:${PORT}`);
    console.log(`📁 Dossier d'uploads: ${uploadsDir}`);
});
