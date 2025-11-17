# FoodID - AI-Powered Food Identification App

A modern web application that uses OpenAI Vision API to identify dishes from photos, providing detailed information including nutrition facts, descriptions, and recipe links.

## Features

- **Camera & Upload**: Capture photos directly or upload existing images
- **AI Identification**: Advanced dish recognition using OpenAI's GPT-4o Vision
- **Three-View Analysis**: Processes images with multiple crops for better accuracy
- **Nutrition Data**: Integration with Edamam and USDA FoodData Central APIs
- **Recipe Links**: TheMealDB integration with curated fallback database
- **Favorites System**: Save dishes locally for quick access
- **Confidence Scoring**: Shows alternative suggestions when confidence is low
- **Mobile-First Design**: Responsive interface optimized for mobile devices

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **TanStack Query** for API state management
- **Wouter** for client-side routing
- **shadcn/ui** for UI components

### Backend
- **Node.js + Express** server
- **OpenAI Vision API** for dish identification
- **Multiple nutrition APIs** (Edamam, USDA FDC)
- **Wikipedia API** for dish descriptions
- **TheMealDB API** for recipes
- **In-memory caching** with TTL support

## Setup & Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd food-id-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Add your API keys:
   - `OPENAI_API_KEY` (required)
   - `EDAMAM_APP_ID` and `EDAMAM_APP_KEY` (optional)
   - `USDA_FDC_API_KEY` (optional)

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### `POST /api/identify`
Identifies a dish from a base64 image.

**Request:**
```json
{
  "image_base64": "base64-encoded-image-data"
}
