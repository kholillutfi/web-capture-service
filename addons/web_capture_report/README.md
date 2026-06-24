# Odoo Web Capture

Odoo Web Capture is an Odoo module used to capture Odoo web pages as screenshots or PDF files.

The module works together with a Node.js Capture Server. Odoo is used as the main user interface for configuration, capture records, capture execution, screenshot preview, and PDF result storage. The Node.js server is used as the browser engine that opens the target Odoo page and generates the capture result.

This module is suitable for visual reporting needs such as dashboards, Gantt views, list views, form views, accounting dashboards, manufacturing reports, and other Odoo pages that need to be saved or shared as image or PDF files.

---

## Main Purpose

Odoo Web Capture helps users generate visual reports directly from Odoo pages.

Instead of manually opening a page, taking a screenshot, cropping it, converting it to PDF, and sending it manually, this module allows the process to be handled directly from Odoo.

Common use cases:

- Capture Accounting Dashboard
- Capture Manufacturing Gantt View
- Capture Sales Dashboard
- Capture List View
- Capture Form View
- Capture custom report pages
- Save screenshot result in Odoo
- Convert screenshot result to PDF
- Store generated PDF as an attachment
- Prepare visual reports for manual or automated reporting

---

## How It Works

The module consists of two main parts:

### 1. Odoo Web Capture Addon

The Odoo addon provides the user interface to:

- Configure the Node.js Capture Server
- Create capture records
- Input the target Odoo page URL
- Set page resolution
- Set crop area
- Enable full page capture
- Enable PDF conversion
- Run capture from the Capture Now button
- Preview screenshot result
- Download generated PDF file

### 2. Node.js Capture Server

The Node.js Capture Server is responsible for:

- Receiving capture requests from Odoo
- Opening the target Odoo URL
- Rendering the page using a browser engine
- Taking the screenshot
- Returning the capture result to Odoo
- Generating PDF output when required

---

## Process Flow

```text
Odoo Web Capture Addon
        |
        | Send capture request
        v
Node.js Capture Server
        |
        | Open target Odoo URL
        v
Odoo Web Page
        |
        | Generate screenshot / PDF
        v
Capture result stored in Odoo