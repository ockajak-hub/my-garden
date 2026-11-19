# My Garden App 🪴

A fun, interactive garden management tool that helps you track your trees' care schedules with points, streaks and badges.

## Features

- 🌳 **Garden Map**: Visualize your garden with draggable trees
- 📋 **Care Tasks**: Automatic watering, pruning and chemical-treatment reminders
- 🕰️ **History Timeline**: See all your gardening activities
- 🏆 **Gamification**: Earn points, build streaks, unlock badges
- 🔧 **Local Storage**: Everything saved in your browser

## How to Use

1. Click **"🌱 Plant a tree"** to add trees to your garden
2. Drag trees around the map to place them where you want
3. Set watering frequency, pruning months and chemical-treatment months
4. Complete care tasks to earn points and unlock badges
5. View upcoming due tasks in the "📋 Tasks" tab
6. See your garden history and stats in the respective tabs

## Data Storage

The app uses **browser's local storage** for saving your data:
- Your garden content (trees, locations, care dates)
- Progress tracking (points, badges, streaks)
- History timeline

**Important**: This data is stored only in your browser. To backup your garden, use the "⚙️ Settings" tab to:
- Export your garden as a JSON file (click "Export backup")
- Import it later on another device or browser

## Running the App

### Option 1: Direct File Access (Easiest)
1. Save all files in a folder
2. Open `index.html` directly in your web browser (drag it into your browser window)

### Option 2: Local Server
1. Save all files in a folder
2. Navigate to that folder in terminal
3. Run: `./run.sh`
4. Visit `http://localhost:8000` in your browser

## Customization

The app is completely self-contained with no external dependencies:
- All code runs locally in your browser
- Works offline once loaded
- No server needed

## Support

If you have questions, just let me know! The garden data will persist in the same browser until you clear local storage or manually export it.