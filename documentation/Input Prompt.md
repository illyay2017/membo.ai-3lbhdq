```
# membo.ai

# WHY - Vision & Purpose

## 1. Purpose & Users

membo is a personal knowledge retention system that converts important information—from book highlights, saved blog posts, bookmarked content, and social media posts—into smart flashcards. It uses Spaced Repetition System (SRS) to transform what users consider important into knowledge they retain.

- Target users: students, language learners, professionals looking to improve their work habits, interview candidates who are studying for interviews
- Key differentiators:
    - Capture first:
        - similar to GTD for task management - this “knowledge retention management” platform includes a “capture” step as a critical starting point (via a Chrome extension) - unlike incumbents;
    - AI-first:
        - SRS flashcards are generated automatically from captured content, instead of users having to build them from scratch using tedious mechanics + syntax (Anki, Mochi);
    - Voice-first:
        - users are largely able to interact with the app with voice only. For example: a language learner can review their Spanish Vocabulary flashcard deck while jogging, using speech-to-text to interact with the app, practice pronunciation, and text-to-speech to get feedback back into their headphones;

# WHAT - Core Requirements

## 2. Functional Requirements

System must:

- Sync captured information (for example: saved LinkedIn posts, Kindle book highlights) to the user’s account for subsequent processing;
- Leverage generative AI to allow users to automatically create flash cards from captured content
- Leverage generative AI to allow users to create quizzes based on cards or decks
- Allow users to create flashcards manually themselves
- Support the FSRS spaced repetition scheduling algorithm, but be built such that migrating to future, improved algorithms would be easy for end-users
- Support common SRS paradigms and patterns, such as:
    - standard front/back flash cards;
    - cloze cards
    - diagram cards
- Generate cards with AI using SRS best practices for what makes good flash cards
- be voice-first, except in cases where that is prohibitive (such as a flash card with an image on it)
    - for strong accessibility
    - for improved, hands-free UX

### User Capabilities

Users must be able to:

- **Capture:**
    - use a Chrome extension that
        - allows users to visually highlight text on any webpage or PDF they are viewing;
        - allows users to scrape their Kindle book highlights when on the amazon kindle notebook domain;
        - sync captured content to their membo cloud;
    - take notes within the app in “note taking” mode;
- **Select:** review their captured content from a dedicated inbox and decide whether to discard or archive it, or create flash cards from it
- **Create:** create flash cards from captured content using generative AI, or manually, or create quizzes from flash cards
- **Organize:** tag flash cards, associate cards to decks, search through captured content as well as cards
- **Learn:** review and study cards, including in “voice mode” for hands-free review
- view their profile information, including analytics of capture, retention, usage, etc;

# HOW - Planning & Implementation

## 3. Technical Foundation

### Required Stack Components

- Frontend:
    - Chrome extension for capture;
    - responsive webapp for content management and card creation, studying, as well as administrative actions (settings, payments, etc),
    - mobile app
    - TailwindCSS + Shadcn for styling
    - Iconography: lucide-react
    - React + React Native + JSX / JavaScript front-end (**do not** use TypeScript)
    - “universall app” stack preferred for a unified codebase across the front-end properties (extension, webapp, mobile iOS app, Android app)
- Backend:
    - Node.js server
    - RESTful API architecture, in adherence with OpenAPI standards
    - Supabase for DBMS, including handling authentication (server-side implementation)
- Integrations:
    - Stripe for payments
    - OpenAI for generative-AI-enabled flash card creation
- Infrastructure
    - unit tests for all components
    - E2E tests
    - CI/CD via GitHub actions
        - staging environment
        - production environment
    - Secret storage in Github Secrets
- local development configuration:
    - must use docker compose, with ability to use a single dev command to spin up
        - front end
        - backend
        - ngrok for proxying public traffic into local instance (for testing)
    - devs will use Supabase CLI to spin up a local Supabase instance (not containerized via Docker / best practice)
    - staging and production hosted on GCP

### System Requirements

Open to recommendations

## 4. User Experience

### Key User Flows

1. **Capture** of content
    - Entry: User installs and activates Chrome extension
    - Steps: Open extension → Log in → Activate “Capture Mode” → Highlight a paragraph on a news article
    - Success: the highlight appears in the extension/sidebar, and is instantly synced to the user’s account “Inbox” for subsequent processing
    - Alternative:
        1. User “bulk captures” their entire Amazon Kindle highlights collection, from all books on their profile;
        2. User is offline and captures highlights from a PDF, which are queued for syncing to their account after they reconnect;
        3. User enters “note taking” mode and is typing up notes as they go (for example, during a class);
2. **Selection** of captured content:
    - Entry: User navigates to their content Inbox
    - Steps: Log into app → Go to Inbox → select top “Captured content” item → Create Card(s) / Archive / Discard;
    - Success: Depending on user selection, the content is either discarded, archived, or the user is taken to card creation flow. The item is then moved out of the Inbox;
    - Alternative: none
3. **Creation** of 
    1. flash cards:
        - Entry: User selects “Create Card(s)” from a captured content item from their Inbox;
        - Steps: User either types in the front and back of a card manually or presses a “Generate” button → a flash creation UI confirms the creation of the card (if manually chosen), allowing the user to generate additional cards; or if the “Generate” option is chosen - AI generates a card or cards (as appropriate) for the user based on the content item. The user can then select which generate card(s) they would like to accept, and is able to edit them manually;
        - Success**:** a flash card or flash cards are created
        - Alternative: the user creates a new card completely manually, not from within the Inbox / not tied to a specific piece of captured content
    2. quizzes:
        1. Entry: User enters a “my content” view in the app;
        2. Steps: User searches for cards or decks, searching using the search bar or using filters, and tags → user selects individual cards or entire decks to be “added to quiz” → generative AI generates a quiz for the user to take in “quiz mode” - a modified study mode which unlike the regular SRS review/study mode is more focused + scoped to the selected materials
        3. Success: a quiz is created based on the select card + deck combination
        4. Alternative: none
4. **Organization** of flash cards:
    - Entry: User selects “Create Card(s)” from a captured content item from their Inbox;
    - Steps: as the card(s) is/are created (manually or generated with AI) - each card has “tags” that can be added → user adds tags → user links card to a deck or decks (optional)
    - Success: the created card(s) are retrievable and filterable by tag association or deck association, and these associations are easily modifiable
    - Alternative: none
5. **Learning** of content:
    - Entry: User presses “Review” or “Learn” button
    - Steps: A card is presented on screen → user knows or does not know the answer → user reveals the answer and scores their “recall difficulty” (see FSRS algorithm, for example: Again, Hard, Good, Easy)
    - Success: the card is scheduled for review at the appropriate time (longer if recalled / recalled easily - shorter if forgotten or recalled with difficulty)
    - Alternative:
        - user stars “Voice study” mode on the mobile app for their “Spanish vocabulary” deck → their headphones say “Hello” → a pleasant soft tone indicates the end of the “flashcard” and the system awaiting the user’s audio input → the user says “Hola” → a pleasant tone indicates the user’s input was the correct answer to the card → the card is scheduled for review accordingly
        - user starts “quiz mode” by creating a quiz from the “my cards” view, or selecting a previously-created quiz, and going through the questions. The quiz is graded and score history is maintained over time.

### Core Interfaces

1. Landing page:
    1. clearly presents:
        - pain points (Information Overload, poor knowledge retention, lack of time to study, information scatter, maybe others?)
        - value proposition to various target user types
        - differentiators from incumbents
    2. has a clear, floating CTA
2. Application: 
    1. Content Inbox - for reviewing and selecting or discarding captured content
    2. Card/Deck Management - for browsing through existing cards and decks, editing them, organizing, searching and filtering, etc
        1. quizzes can be created from this interface
    3. Study mode - for studying the flash cards, and quizzes
    4. Profile and Settings page - for account management, usage and study statistics, settings
3. Chrome extension:
    1. Log In / Sign Out
    2. View Captured content and its “sync” status
    3. Automatically load captured highlights into the DOM where applicable (if user revisits previously-captured web page, automatically re-highlight previously-highlighted elements)

## 5. Business Requirements

### Access & Authentication

- User types: Individual account holders and administrators (who may invite users to view decks they have created). Also open to recommendations, for multi-user accounts (i.e. a company with an administrative user creating decks for employee training, with employees who can only view cards/decks, and other employee types who can also created cards/decks);
- Authentication requirements: Email/password, allow for sign up with Google
- Access control needs:
    - users must sign up with a valid email, and verify before getting access (Supabase standard)
    - a modified “reverse trial” model will be used, where new users will have slightly modified full feature access:
        - generative AI usage for card + quiz generation + voice-to-text will be limited to prevent high-compute-cost free users that do not convert
        - after 14 days, users will be downgraded to the free tier if they do not provide payment
    - **Free tier** will offer:
        - unlimited manual card creation, but no generative card, quiz, or voice-to-text / “voice mode” capabilities
    - **Pro** tier will offer everything in Free plus:
        - limited AI credits for generation of cards
        - “Voice mode”
    - **Power** tier will offer everything in Pro plus:
        - more AI credits for generation of cards
        - quizzes
    - **Enterprise** tier will:
        - be custom to the customer
        - offer high amounts of AI credits
        - allow advanced permissions (various role levels for creating and administering cards, quizzes, etc., i.e. an employer using membo as a training platform for its workforce)
    - open to suggestions on pricing of tiers, bearing in mind potential compute costs related to:
        - cards created through generative AI
        - voice-to-text / text-to-voice

## 6. Implementation Priorities

- High Priority:
    - Chrome extension for easy content capture
        - capture highlights (text selection) from any webpage
        - scrape Kindle book highlights
    - A responsive web, and mobile app, with ability to process captured content, create cards, organize, and study them using FSRS
    - Generative AI for card creation and quiz creation
    - A seamless interactive onboarding experience for first-time users, ensuring they are:
        - guided about installing the Chrome extension;
        - Log into said extension;
        - Capture a piece of content;
        - Access their inbox;
        - Create a flash card from the content using generative AI;
        - “Study” the card
            - also be allowed to “try voice mode”
- Medium Priority:
    - Voice-to-text and text-to-voice interactivity with the application
    - support for “diagram cards”, where images can be uploaded and then, using a canvas, “diagrammed” with cloze-like elements (i.e. user can see a diagram of the human heart, with various “fill in the blank” labels around various anatomical parts, and reveal the answers to each one, as if each “blank” is its own index card);
    - application should be featureful when compared to Anki, Mochi.cards, Traverse.link
    - application should, through settings or out of the box, address frequently-discussed pain points for Anki and Mochi users (reddit, reviews, etc)
- Lower Priority:
    - Enterprise  accounts and relevant permissions;
    - Chrome extension:
        - capture from PDF
        - LinkedIn “auto capture post on save”
        - Twitter / X “auto capture tweet on like”
        - Reddit “auto capture post on bookmark”
```