# 📁 Public Drive

A simple, elegant file sharing web application built with Node.js. No authentication required — just upload and share!

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Features

- 🚀 **Drag & Drop Upload** — Simply drop your files to upload
- 📂 **Folder Organization** — Create folders and organize your files
- 👀 **Built-in Preview** — View PDFs and text files directly in the browser
- 🎨 **Modern Dark UI** — Beautiful glassmorphism design with smooth animations
- 🔒 **File Type Filtering** — Only `.txt` and `.pdf` files accepted
- ⚡ **No Authentication** — Public access for quick sharing

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/xxloubexx/public-drive-v2.git
cd public-drive-v2

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

---

## 📦 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express** | Web framework |
| **Multer** | File upload handling |
| **Vanilla JS/CSS** | Frontend (no framework) |

---

## 📁 Project Structure

```
public-drive/
├── server.js          # Express server & API routes
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Main page
│   ├── style.css      # Dark theme styles
│   └── script.js      # Frontend logic
└── uploads/           # Uploaded files (auto-created)
```

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/files?path=` | List files & folders |
| `POST` | `/upload` | Upload a file |
| `POST` | `/folders` | Create a folder |
| `GET` | `/files/*` | Download a file |
| `DELETE` | `/files/*` | Delete file/folder |

---

## 📝 License

MIT © 2024
