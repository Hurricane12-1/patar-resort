# J & D Reserve: Figma Mid-Fidelity Prototype Suite & Import Guide

> **Capstone Project Title:** *J & D Reserve: A Web-Based Reservation and Booking Management System for J & D Beach House, Brgy. Patar, Bolinao, Pangasinan*  
> **Deliverable:** Mid-Fidelity Figma Prototype Suite (Vector SVG Artboards + DTCG Design Tokens + Interactive Web Companion)  
> **Target Audience:** Capstone Defense Panel, System Architects, UI/UX Evaluators  

---

## 1. Executive Summary & Design Rationale

This **Mid-Fidelity (Mid-Fi) Prototype** replicates the **exact layout, components, user flows, and features** of the live J & D Beach House resort application.

### Key Quality & Architectural Alignments
- **Canonical Accommodations Roster**: Restricted strictly to the real resort units:
  1. **Unit TEV** (Grand Beachfront Villa · Rate: ₱18,000/night · Capacity: Up to 60 guests)
  2. **Unit CAT** (Beach Cottage / Unit Papang · Rate: ₱6,000/night · Capacity: Up to 10 guests)
  3. **Unit GEL** (Premier Coastal Suite · Rate: ₱12,000/night · Capacity: Up to 25 guests)
  4. **Unit CATH** (Executive Veranda Villa · Rate: ₱8,500/night · Capacity: Up to 15 guests)
  *All extraneous mock rooms have been completely removed.*
- **Clean English Grammar & Spelling**: All chatbot messages, system prompts, badges, and interface copy have been edited for flawless spelling, correct punctuation, and a polite hospitality tone.
- **Exact Resort Color Tokens**: Primary Ocean Sky (`#0EA5E9`), Deep Navy Slate (`#0F172A`), Sand Amber (`#F59E0B`), Clean Emerald (`#10B981`), Canvas Black (`#0A0F1D`).
- **Typography Scale**: Display Serif (`Playfair Display`), Modern UI (`Plus Jakarta Sans`), and Technical Monospace (`JetBrains Mono`).
- **Real Computational Math**: 12% statutory VAT + ₱100 Bolinao environmental fee + 50% reservation deposit matching backend logic.

---

## 2. Inventory of Generated Figma Files

All files are located in:
📁 **`C:\Users\Sheep\OneDrive\Desktop\JND_Reserve_MidFi_Prototype\`**  
📁 **`C:\Users\Sheep\OneDrive\Documents\Capstone 1 sided\mid-fidelity-prototype\`**

| File Name | Dimensions | Description & Features |
| :--- | :--- | :--- |
| **`master_figma_prototype_board.svg`** | 4000 × 1750 | **Streamlined 3-Screen Master Board**: Shows the 3 core screens side-by-side with docked AI Concierge widget and clean title header. |
| **`01_guest_landing_home.svg`** | 1440 × 1520 | **Screen 01 · Guest Discovery**: Cape Bolinao hero, Manila live PST clock, quick availability dock, stats, and 4 canonical unit cards (TEV, CAT, GEL, CATH). |
| **`03_booking_and_checkout_modal.svg`** | 1440 × 1024 | **Screen 02 · Booking & OTP Checkout**: Dynamic price math for Unit TEV (₱18k × 2 + VAT + fee), Nodemailer 6-digit OTP verification, and GCash QR settlement. |
| **`05_front_desk_receptionist_matrix.svg`** | 1440 × 1024 | **Screen 03 · Front Desk Status Matrix**: Live room status grid for TEV, CAT, GEL, and CATH with 60-second walk-in ledger. |
| **`07_ambient_ai_concierge_widget.svg`** | 1440 × 1024 | **Ambient AI Concierge**: Flawless grammar and spelling, polite guest dialogue, suggestions, and instant booking deep-links. |
| **`midfi_figma_board.jpg`** | Visual Graphic | Complete Figma application canvas render showing all 3 screens and AI Concierge. |
| **`high-quality-renders/01_guest_landing_screen.jpg`** | High-Res UI | Dedicated high-quality render of Screen 1: Guest Landing, Hero & Accommodations (TEV, CAT, GEL, CATH). |
| **`high-quality-renders/02_booking_and_otp_checkout.jpg`** | High-Res UI | Dedicated high-quality render of Screen 2: Booking Summary & Nodemailer OTP Verification Modal. |
| **`high-quality-renders/03_front_desk_status_matrix.jpg`** | High-Res UI | Dedicated high-quality render of Screen 3: Front Desk Room Status Matrix. |
| **`high-quality-renders/04_ambient_ai_concierge_chatbot.jpg`** | High-Res UI | Dedicated high-quality render of Ambient AI Concierge Chatbot Widget. |
| **`figma_design_tokens.json`** | DTCG JSON | Standard design tokens file importable via *Tokens Studio for Figma* or native Figma Variables. |
| **`interactive_prototype.html`** | Standalone HTML | Fully interactive, clickable web prototype with live screen switching, modal math, and bot drawer. |

---

## 3. How to Import into Figma in 10 Seconds

### Method A: One-Click Drag & Drop (Recommended)
1. Open your browser to [figma.com](https://www.figma.com) and create a **`+ New design file`**.
2. Open Windows File Explorer to:
   ```
   C:\Users\Sheep\OneDrive\Desktop\JND_Reserve_MidFi_Prototype\figma-svg-frames\
   ```
3. Drag **`master_figma_prototype_board.svg`** (or any individual screen) directly onto your Figma canvas.
4. Figma will instantly parse each vector SVG into native, editable Figma **Frames, Groups, Text Layers, Vector Paths, and Fills**.

### Method B: Figma Menu Place Image / Vector (`Ctrl + Shift + K`)
1. In Figma, press **`Ctrl + Shift + K`** (or Menu ➔ File ➔ Place image...).
2. Select the `.svg` files from `figma-svg-frames/`.
3. Click anywhere on your Figma canvas to drop them in.

---

## 4. Live Interactive Web Preview

To experience the interactive prototype directly in your browser:
- Double-click [interactive_prototype.html](file:///C:/Users/Sheep/OneDrive/Desktop/JND_Reserve_MidFi_Prototype/interactive_prototype.html) on your Desktop, or run:
  ```powershell
  Start-Process "C:\Users\Sheep\OneDrive\Desktop\JND_Reserve_MidFi_Prototype\interactive_prototype.html"
  ```
