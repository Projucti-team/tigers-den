# The Tigers' Den — Brand Design Guidelines
**Document Version:** 1.0.0  
**Target Audience:** Bangladesh Cricket Fan Army Hub (Barmy Army Style)  
**Author:** Friday (System Architecture & Brand Design AI)

---

## 1. Executive Summary & Brand Essence

### 1.1 Brand Vision
**The Tigers' Den** aims to be the definitive, high-energy community hub and travel group for passionate Bangladesh Cricket fans worldwide. Heavily inspired by the structural and community framework of England's 'Barmy Army', it scales up traditional fan camaraderie into an organised, loud, and deeply loyal group supporting the Bangladesh National Cricket Team across all formats globally.

### 1.2 Brand Voice & Personality
Our brand personality must reflect the atmosphere of the grandstands at Mirpur, Lord's, or Melbourne. It is:
* **Passionate & Roaring:** Loud, proud, and uncompromisingly enthusiastic.
* **Community-First:** Inclusivity for everyday fans traveling across the world or watching from home.
* **Witty & Banner-Ready:** Playful banter, classic cricket humour, and quick-witted chants.
* **Resilient:** Standing firmly behind the team through every monumental victory and challenging collapse.

---

## 2. Visual Identity & Logo Guidelines

### 2.1 Logo Architecture
The primary identity combines three foundational elements:
1.  **The Roaring Bengal Tiger:** Stylised, modern silhouette (not corporate, but fierce and aggressive).
2.  **The Crossed Cricket Bats:** Representing our undying love for the game.
3.  **The Green & Red Roundel/Shield:** A classic football/cricket club badge silhouette that looks excellent embroidered on supporter shirts or rendered as a 32x32px website favicon.

```
      /     /  \       [ Shield Contour ]
    / /\ \      ==================
   | |  | |     - Inner Core: Stylised Roaring Tiger Face
   | |__| |     - Lower Base: Crossed Harrow-style Bats
    \====/      - Text Ring: THE TIGERS' DEN • EST. 2026
```

### 2.2 Clear Space Requirements
Always maintain a minimum clear space surrounding the logo equal to **0.5X** of the total badge width. This ensures text headers or UI elements do not encroach on the mark's visual prominence.

### 2.3 System Restrictions
* **Do NOT** apply drop shadows or bevels to the emblem flat graphics.
* **Do NOT** substitute the official deep green with bright neon tones.
* **Do NOT** isolate the tiger graphic outside of the badge boundaries on official tour merchandise.

---

## 3. Typography Matrix

Typography must reflect stadium infrastructure—bold, robust, and highly visible from a distance, paired with crisp, clean layouts for high-density live scorecard matrices.

### 3.1 Primary Font Family: Display & Headers
* **Font Name:** `Montserrat` (Set to **Bold / Extra Bold**, All-Caps)
* **Alternative Fallbacks:** `Impact`, `Arial Black`
* **Usage:** Level 1 & Level 2 Page Section Headings, Banner Titles, and Stadium Chants Card Headings.

### 3.2 Secondary Font Family: Scorecards & Data Tables
* **Font Name:** `Inter` or `Roboto Mono`
* **Usage:** Live ball-by-ball commentary, runs/wickets data tables, current run rates (CRR), and backend dashboard interfaces.
* **Why:** High legibility at small point sizes (`10pt–12pt`) during volatile traffic spikes.

### 3.3 Typography Sizing Guide (Web/Mobile Scale)

| Level | Font Family | Weight | Size (Desktop) | Size (Mobile) | Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **H1** | Montserrat | Extra Bold | `32px` | `24px` | Uppercase |
| **H2** | Montserrat | Bold | `22px` | `18px` | Uppercase |
| **H3** | Inter | Semi-Bold | `16px` | `14px` | Sentence |
| **Body**| Inter | Regular | `14px` | `14px` | Sentence |
| **Data**| Roboto Mono| Medium | `12px` | `11px` | Uppercase |

---

## 4. Master Colour Palette

A strict, high-contrast, premium sports-palette that leans heavily on Bangladesh's proud national colours, carefully optimised for dark/light balanced UI workflows.

```
+-----------------+-----------------+-----------------+-----------------+
|                 |                 |                 |                 |
|  EMERALD GREEN  |  CRIMSON RED    |  STADIUM AMBER  |  CRISP WHITE    |
|    #006A4E      |    #F42A41      |    #FFB800      |    #FFFFFF      |
|                 |                 |                 |                 |
+-----------------+-----------------+-----------------+-----------------+
|  CHARCOAL SLATE |  SOFT ICE BLUE  |  PITCH DARK     |
|    #212529      |    #F8F9FA      |    #111111      |
|                 |                 |                 |
+-----------------------------------------------------+
```

### 4.1 Colour Descriptions & UI Token Mapping
* **Primary Core (60%):** `Emerald Green (#006A4E)`
    * *UI Use:* Global Navigation Bars, Button backgrounds, Primary layout headings.
* **Accent Strike (20%):** `Crimson Red (#F42A41)`
    * *UI Use:* Live Match Blinkers (`🔴 LIVE`), CTAs, high-priority notifications, and ticket purchasing alerts.
* **Secondary Support (10%):** `Stadium Amber (#FFB800)`
    * *UI Use:* Highlighted content cards, active forum pins, and player metric ratings (e.g., Man of the Match percentages).
* **Base Neutral Surfaces (10%):** * `Soft Ice Blue (#F8F9FA)` for content container backgrounds.
    * `Charcoal Slate (#212529)` for crisp text formatting.

---

## 5. UI & Layout Component Blueprint

To implement the designs smoothly across Dart (Flutter), Nunjucks, or HTML5 frontend layers, follow these structural UI configurations.

### 5.1 Component Grid Layout (Desktop 1440px)
* **Type:** 12-Column Grid system.
* **Gutter Width:** `24px`.
* **Marginal Padding:** `64px` left/right.

### 5.2 Live Scorecard Widget Blueprint
```
+-------------------------------------------------------------------------+
| [🟢 EMERALD CORE HEADER]  BAN vs ENG — 2nd ODI (Mirpur)    🔴 LIVE (RED) |
+-------------------------------------------------------------------------+
|                                                                         |
|   BAN: 274/5 (44.2 ov)  •  CRR: 6.18                                    |
|   -------------------------------------------------------------------   |
|   Litton Das:  92* (88b)   [4s: 8 | 6s: 3]                              |
|   Mahmudullah: 14 (12b)    [4s: 1 | 6s: 0]                              |
|                                                                         |
+-------------------------------------------------------------------------+
| [AMBER HIGH-LIGHT BUTTON] => Full Ball-by-Ball Commentary & Statistics  |
+-------------------------------------------------------------------------+
```
* **Border Radius:** All elements default to `8px` rounded tracking to maintain a modern, friendly yet robust feel.
* **Card Background:** Pure white (`#FFFFFF`) sitting neatly over a light neutral canvas (`#F8F9FA`).

### 5.3 Button State Blueprint
* **Default Active State:** Full Emerald Green fill, white bold uppercase text, `transition: background 0.2s ease-in-out`.
* **Hover/Focus State:** Background-colour brightens slightly; thin border ring in Stadium Amber highlights the frame boundary.
* **Disabled State:** Light grey fill (`#E9ECEF`), muted charcoal text, pointer-events completely restricted.

---

## 6. Community & Merchandising Rules

As an army styled hub, travel apparel and community visual presentation are foundational assets.

### 6.1 Tour Shirt Aesthetics
* The primary tour shirts must feature clean **vertical alternating dark-green/emerald green pinstripes** accented with solid Crimson Red sleeve caps.
* The official motto text: `"The Green & Red Army On Tour"` must be printed along the inner seam of the collar.

### 6.2 Digital Community Conduct Visual Flags
* **Verified Organisers:** Golden Amber crown badge next to their handle profile picture.
* **Touring Members:** Crimson passport icon reflecting active attendance in live international tours.

---

*End of Document. Designed for direct export into markdown systems or conversion to digital design documentation portals.*
