# 🚀 Form Builder v2 Setup

Build and run **Form.io v4.21.2** locally, customize the source code, and generate your own `formio.full.js` and `formio.full.css`.

---

# 📁 Project Structure

```text
FORMBUILDER
│
├── FormBuilderAppService      ← .NET 8 Web API (Backend)
│   ├── Controllers
│   ├── Program.cs
│   ├── appsettings.json
│   └── ...
│
└── FormBuilderJs              ← Form.io Source Code (Frontend)
    ├── app
    ├── src
    ├── dist
    └── ...
```

---

# 📥 1. Download Source

Download **Form.io v4.21.2** and extract it.

```text
https://github.com/formio/formio.js/releases/tag/v4.21.2
```

---

# 🟢 2. Install Node.js 18

```bash
nvm install 18
nvm use 18
node -v
```

Expected:

```text
v18.x.x
```

---

# 📦 3. Install Dependencies

```bash
rmdir /s /q node_modules
del package-lock.json

npm install
```

---

# 🔨 4. Build Form.io

```bash
npm run transpile
npm run templates
npx gulp build
```

Verify:

```text
dist/
 ├── formio.full.js
 └── formio.full.css
```

---

# 🌐 5. Run Locally

Start server:

```bash
npx http-server
```

Open:

```text
http://localhost:8080/homePage.html
```

---

# 🔄 Daily Workflow

After modifying files inside:

```text
src/
app/
components/
templates/
```

Run:

```bash
npm run transpile
npx gulp build
```

Refresh the browser.

---

# 🎯 Frontend Features

* Form Builder
* Drag & Drop Components
* JSON Generation
* Form Rendering
* Custom Components
* Offline Usage
* No Form.io Server Required

---

# 🔗 Backend (.NET 8 Web API)

The backend provides REST APIs to manage forms.

```text
GET    /api/forms
GET    /api/forms/{id}
POST   /api/forms
PUT    /api/forms/{id}
DELETE /api/forms/{id}
```

Responsibilities:

* Save forms
* Retrieve forms
* Update forms
* Delete forms
* Form versioning
* API integration

---

# 🗄️ Database

### ✅ v1

* SQL Server
* Dapper
* Stored Procedures

### ✅ v2

* MongoDB
* NoSQL document storage
* Stores complete Form JSON as documents
* Easier versioning and schema flexibility

---

# 🆕 What's New in v2

* ✅ MongoDB replaces SQL Server
* ✅ Simpler document-based storage
* ✅ Better handling of dynamic Form.io JSON
* ✅ Cleaner backend architecture
* ✅ Easier form versioning
* ✅ Faster development for schema changes

---

# 📌 Build Flow

```text
Source Code
      │
      ▼
npm install
      │
      ▼
npm run transpile
      │
      ▼
npm run templates
      │
      ▼
npx gulp build
      │
      ▼
dist/formio.full.js
dist/formio.full.css
      │
      ▼
homePage.html
      │
      ▼
npx http-server
      │
      ▼
Browser
```

---

# 📝 Notes

* Use **Node.js 18**
* Run `npm run transpile` after source changes
* Run `npx gulp build` to regenerate build files
* Refresh the browser to view changes
* Form.io Server is **not required**
* Backend is used only for persistent form storage and APIs
