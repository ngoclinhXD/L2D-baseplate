# Live2D Web Viewer

A lightweight, client-side Live2D model viewer built with PixiJS and the `pixi-live2d-display` wrapper. It uses WebGL to render models directly on the local device with full mouse tracking.

**The default model is Huohuo**
https://booth.pm/en/items/5288339

## Features (so far):

- Mouse Tracking
- Headpats

more coming soon!

## Prerequisites

- A local web server environment (Python or Node.js)
- A Live2D model

## Folder Structure

To avoid missing file errors, ensure your directory is organized like this:

- `index.html`
- `app.js`
- `style.css`
- `live2dcubismcore.min.js`
- `model/` (Place your compiled Live2D model folder here!)

The `model` folder must contain your `.model3.json` file, `.moc3` file, and the texture images.

**REMEMBER TO REPLACE THE MODEL FILE NAME IN `app.js` WITH YOUR OWN**

## How to Run

Because browsers block local files from loading external JSON data, you must run this project through a local server.

Open your terminal in the project folder and use one of the commands below.

**Using Node.JS:**

```bash
npx serve
```

**Using Python:**

```bash
python3 -m http.server 8000
```

---

# Powered by Live2D

https://www.live2d.com/
