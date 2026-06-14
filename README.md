# 🚀 Local Builder Setup

Build and run **Form.io 4.21.2** locally, modify source code, and generate your own `formio.full.js` and `formio.full.css`.

---

# 📁 Folder Structure

```
FORMBUILDER
│
├── FormBuilderAppService      ← .NET 8 Backend Web API
│   ├── Controllers
│   ├── Program.cs
│   ├── appsettings.json
│   └── ...
│
└── FormBuilderJs              ← formio.js Frontend
    ├── app
    ├── src
    ├── dist
    └── ...
```

---

# 📥 Step 1: Download Source Code

Download Form.io **v4.21.2** source code:

https://github.com/formio/formio.js/releases/tag/v4.21.2

Extract the zip file.

Example:

```text
D:\formio.js-4.21.2\formio.js-4.21.2
```

---

# 🟢 Step 2: Install Node.js 18

Form.io 4.21.2 works best with Node 18.

```bash
nvm install 18

nvm use 18

node -v
```

Expected output:

```text
v18.x.x
```

---

# 🧹 Step 3: Clean Existing Packages

Delete old dependencies:

```bash
rmdir /s /q node_modules

del package-lock.json
```

Install packages:

```bash
npm install
```

---

# 🔨 Step 4: Build Form.io

Run:

```bash
npm run transpile

npm run templates

npx gulp build
```

Expected output:

```text
Finished 'build'
```

---

# ✅ Step 5: Verify Generated Files

Go to:

```text
D:\formio.js-4.21.2\formio.js-4.21.2\dist
```

Verify these files exist:

```text
formio.full.js

formio.full.css
```

---

# 🌐 Step 6: Create index.html

Example:

```html
<!DOCTYPE html>
<html>
<head>

<link rel="stylesheet"
href="https://cdn.jsdelivr.net/npm/bootswatch@4.6.2/dist/flatly/bootstrap.min.css">

<link rel="stylesheet"
href="dist/formio.full.css">

</head>

<body>

<div id="builder"></div>

<script src="dist/formio.full.js"></script>

<script>

Formio.builder(
    document.getElementById('builder'),
    {}
);

</script>

</body>
</html>
```

---

# ♻ Step 7: Rebuild After Source Changes

Whenever you modify files inside:

```text
src
app
components
templates
```

Run:

```bash
npm run transpile
```

---

# 🚀 Step 8: Start Local Server

Start the web server:

```bash
npx http-server
```

Press:

```text
y
```

if prompted.

---

# 🌍 Step 9: Open Browser

Example:

```text
http://localhost:8080/test.html
```

or

```text
http://localhost:8080/index.html
```

---

# 🔄 Daily Workflow

### Start Server

```bash
npx http-server
```

---

### Open Browser

```text
http://localhost:8080
```

---

### After Modifying Source Files

```bash
npm run transpile

npx gulp build
```

Refresh the browser.

---

# 🎯 Features Available

✅ Form Builder

✅ Drag & Drop Components

✅ Generate JSON

✅ Render Forms

✅ Modify Source Code

✅ Custom Components

✅ Offline Usage

✅ No Form.io Server Required

✅ Save Forms and Reuse, Edit.

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
index.html
     │
     ▼
npx http-server
     │
     ▼
http://localhost:8080
```

---


# 📚 Notes

* Use **Node.js 18**.
* Run `npm run transpile` after source code changes.
* Run `npx gulp build` to regenerate `formio.full.js`.
* Refresh the browser to see changes.
* Form.io server is not required.
* Everything can run locally.

---
# 🔗 Backend Connection

The project contains two applications:

```text
FORMBUILDER
│
├── FormBuilderAppService      ← .NET 8 Web API (Backend)
│
└── FormBuilderJs              ← Form.io Source Code (Frontend)
```

---

## Frontend (FormBuilderJs)

Purpose:

* Display Form Builder UI.
* Drag and drop components.
* Generate Form JSON.
* Render forms.
* Modify Form.io source code.


## Backend (FormBuilderAppService)

Purpose:

* Store form definitions in database.
* Retrieve saved forms.
* Update existing forms.
* Delete forms.
* Manage form versions.
* Expose REST APIs for frontend.

Example APIs:

```text
GET    /api/forms

GET    /api/forms/{id}

POST   /api/forms

PUT    /api/forms/{id}

DELETE /api/forms/{id}
```

## Why Use a Backend?

Without backend:

* Forms exist only in browser memory.
* Closing the browser loses data.

With backend:

✅ Persistent storage

✅ Database support

✅ CRUD operations (Create, Read, Update, Delete)

✅ Form versioning

✅ Multiple users

✅ Integration with existing applications

✅ Centralized API layer

---

> **Note:** Form Builder itself does not require a server. The .NET 8 backend is added to save and manage form definitions and provide APIs to other applications.

# 🎉 Happy Coding!
