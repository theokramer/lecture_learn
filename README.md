# Nano AI

A stunning, modern React web application designed for university students to organize notes, manage documents, and study effectively with AI-powered tools.

## Features

### Home Screen
- **Nested Folder System**: Create unlimited nested folders to organize notes
- **Search Functionality**: Find notes quickly with the search bar
- **Filter by Folder**: View notes by folder or all notes
- **Multiple Note Creation Methods**:
  - Record audio directly in the app
  - Upload PDF, DOC, TXT files
  - Upload audio files (MP3, WAV)
  - Upload video files (video audio is extracted)
  - Add web links (YouTube, websites, Google Drive)

### Note View with 5 Study Modes
Each note can have up to 3 documents attached and includes:

1. **Summary View**: AI-generated summary of your documents
2. **Feynman Technique**: Interactive AI chat to explain concepts like a 5-year-old
3. **Flashcards**: Auto-generated flashcards with 3D flip animation
4. **Quiz**: Multiple choice questions with instant feedback
5. **Exercises**: Open-ended exercises for practice

### Resizable Panels
- **Collapsible Sidebar**: Toggle navigation panel on/off
- **Resizable AI Chat**: Drag to resize or collapse the chat panel
- **Smooth Animations**: All interactions are fluid and polished

## Design System

- **Dark Theme**: Modern dark UI with carefully chosen colors
  - Background: `#1a1a1a`, `#2a2a2a`, `#3a3a3a`
  - Text: White, `#9ca3af` (subtitles)
  - Accent: Rust `#b85a3a` to Gold `#d4a944` gradient
- **Typography**: Clean system fonts with clear hierarchy
- **Rounded Corners**: 16px for cards, 8px for buttons
- **Smooth Transitions**: 300ms ease animations throughout

## Tech Stack

- **React 19** with TypeScript
- **Framer Motion** for animations
- **React Router** for navigation
- **React Icons** for iconography
- **Vite** for fast development
- **Tailwind CSS** for styling (via utility classes)

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Visit `http://localhost:5173` to view the app.

### Build

```bash
npm run build
```

### Deploy to Vercel

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed deployment instructions.

Quick start:
1. Push your code to GitHub
2. Import your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── home/          # Home screen components
│   ├── modals/        # Modal dialogs
│   ├── note/          # Note view components
│   └── shared/        # Reusable components
├── context/           # React context providers
├── pages/             # Page components
├── styles/            # Design system and global styles
└── types/             # TypeScript type definitions
```

## Key Features Implementation

### Authentication
- Mock login/signup (uses Context API)
- Protected routes with React Router
- Session management

### Data Management
- Context API for state management
- Mock data for folders, notes, and documents
- Easy to replace with real backend integration

### Study Modes
All study modes are fully functional with mocked AI responses:
- Interactive chat interfaces
- Smooth 3D animations
- Progress tracking
- Instant feedback

## Design Principles

1. **Consistency**: Unified design language across all screens
2. **Polish**: Every interaction is smooth and deliberate
3. **Accessibility**: Focus states, keyboard navigation, clear labels
4. **Performance**: Optimized animations at 60fps
5. **User Experience**: Intuitive flows and helpful feedback

## Future Enhancements

- Real authentication with backend
- Cloud sync for documents
- Real AI integration for study modes
- Mobile app using React Native
- Advanced folder organization
- Collaborative features
- Dark/light theme toggle

## License

This project is created for demonstration purposes.