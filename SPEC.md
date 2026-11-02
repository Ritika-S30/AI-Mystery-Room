# AI Mystery Room – Project Specification

**Document:** SPEC.md  
**Project:** AI Mystery Room  
**Status:** Initial MVP specification  
**Purpose:** Single Source of Truth for AI-assisted development

## 1. Project Overview

AI Mystery Room is an interactive mystery investigation web application.

Users enter fictional mystery cases, examine evidence, investigate suspects, connect clues, and identify the culprit.

AI helps generate mystery scenarios, suspects, evidence, and investigation assistance.

The application should provide an engaging detective experience while keeping the mystery solution hidden until the user makes an accusation or requests the reveal.

## 2. Main Objectives

- Generate original fictional mystery cases using AI.
- Provide multiple suspects with different backgrounds and motives.
- Generate evidence that users can investigate.
- Allow users to take notes and request hints.
- Allow users to accuse a suspect.
- Reveal the correct solution and explain the evidence after the investigation.
- Maintain consistency between the culprit, clues, evidence, and final explanation.

## 3. Target Users

People who enjoy:
- Detective stories.
- Mystery-solving games.
- Logical reasoning.
- Interactive investigation experiences.

## 4. Technology Stack

Use the following stack for the MVP:

**Frontend**
- React
- JavaScript
- HTML
- CSS

**Backend**
- Node.js
- Express.js

**Database**
- MongoDB
- Mongoose

**AI**
- Google Gemini API for mystery generation and investigation assistance.

All AI API calls must happen through the backend.

## 5. Main Application Features

### 5.1 Home Page

The home page should contain:
- Application name and branding.
- Short introduction.
- Start Investigation button.
- Clear and simple navigation.

### 5.2 Mystery Generation

Users should be able to start a new mystery.

The AI should generate:
- Mystery title.
- Case description.
- Crime or mystery scenario.
- Location.
- Victim or affected person, when applicable.
- Suspects.
- Motives.
- Possible timelines.
- Evidence.
- Clues.
- Red herrings.
- Final solution.

The culprit must be selected and stored internally before the evidence is presented to the user.

The mystery should be logically solvable using the available evidence.

### 5.3 Suspect Profiles

Each suspect should have:
- Name.
- Age (fictional).
- Background.
- Relationship to the victim or case.
- Possible motive.
- Alibi.
- Relevant information.

Suspect profiles must not directly reveal the culprit.

### 5.4 Evidence Room

Users should be able to inspect different types of fictional evidence, such as:

- Chat messages.
- Documents.
- Written statements.
- Photographs.
- CCTV-style descriptions or transcripts.
- Timelines.
- Other relevant investigation records.

Every evidence item should contain:
- Evidence title.
- Evidence type.
- Description or content.
- Relevant time, if applicable.
- Related suspect or location, if applicable.

Evidence must be clearly fictional.

### 5.5 Investigation Workspace

Users should be able to:
- View the case details.
- View suspects.
- Open evidence.
- Review clues.
- Create personal investigation notes.
- Request hints.
- Track their investigation progress.

### 5.6 AI Investigation Assistant

Provide an AI assistant that can help users think through the case.

It should:
- Answer questions about available evidence.
- Explain difficult clues.
- Suggest possible connections.
- Provide hints when requested.
- Encourage logical reasoning.

It must not reveal the culprit or final solution before the user is allowed to see it.

### 5.7 Accusation System

Users should be able to select a suspect and submit an accusation.

The backend must compare the accusation against the stored correct culprit.

The result should indicate whether the accusation is correct.

### 5.8 Solution Reveal

After an accusation or permitted solution reveal, show:
- Correct culprit.
- Motive.
- Explanation of what happened.
- Important clues.
- How the evidence connects.
- Explanation of red herrings.

The solution should be consistent with the original mystery.

## 6. AI Generation Rules

AI-generated mystery content must follow strict consistency rules.

1. Decide the culprit before generating evidence.
2. Store the correct culprit securely on the backend.
3. Generate evidence that supports the final solution.
4. Include believable alternative explanations.
5. Ensure red herrings do not make the mystery impossible to solve.
6. Validate AI-generated structured data before saving.
7. Regenerate or reject invalid responses.
8. Never trust AI output without backend validation.
9. Never expose the solution in frontend API responses before the reveal is permitted.

Use structured JSON responses wherever possible.

## 7. Database Design

Suggested collections:

### Users
- userId
- username
- email
- passwordHash (only if password-based authentication is implemented)
- createdAt

### Mysteries
- mysteryId
- title
- description
- difficulty
- scenario
- status
- createdAt

### Suspects
- suspectId
- mysteryId
- name
- background
- motive
- alibi

### Evidence
- evidenceId
- mysteryId
- title
- type
- content
- relatedSuspects
- timestamp

### Investigation
- investigationId
- userId or guestId
- mysteryId
- notes
- hintsUsed
- accusation
- result
- completedAt

Keep the correct culprit and solution in protected backend data. Do not return these fields through ordinary mystery, suspect, or evidence endpoints.

## 8. Backend API Structure

Suggested endpoints:

- POST /api/mysteries/generate
- GET /api/mysteries
- GET /api/mysteries/:id
- GET /api/mysteries/:id/suspects
- GET /api/mysteries/:id/evidence
- POST /api/investigations
- POST /api/investigations/:id/notes
- POST /api/investigations/:id/hint
- POST /api/investigations/:id/accuse
- GET /api/investigations/:id/solution

Protect endpoints and validate all incoming data.

Only reveal the solution when the backend confirms that the reveal is permitted.

## 9. Security Requirements

- Keep Gemini API keys in backend environment variables.
- Never expose API keys in frontend code.
- Validate user inputs.
- Use secure authentication if accounts are implemented.
- Protect private investigation data.
- Restrict access to protected solution information.
- Apply appropriate request limits to AI endpoints.
- Do not execute AI-generated code or commands.
- Avoid storing unnecessary personal information.

## 10. User Interface Design

The design should feel like a detective investigation room.

Suggested visual direction:
- Dark investigation-room theme.
- Clean and readable typography.
- Evidence cards.
- Suspect profiles.
- Timeline layout.
- Investigation dashboard.
- Clear navigation.
- Responsive design for tablets, mobile phones, and desktops.

The interface should be easy to understand for first-time users.

## 11. Development Phases

### Phase 1 – Project Foundation
- Set up React frontend.
- Set up Express backend.
- Connect MongoDB.
- Configure environment variables.
- Create the basic application structure.

### Phase 2 – Mystery System
- Implement mystery generation.
- Generate suspects.
- Generate evidence.
- Validate mystery consistency.
- Store mystery data.

### Phase 3 – Investigation Interface
- Build mystery details page.
- Build suspect profiles.
- Build evidence room.
- Add investigation notes.
- Add timeline.

### Phase 4 – AI Assistant
- Connect Gemini API through backend.
- Implement hints.
- Implement evidence-based question answering.
- Prevent premature solution disclosure.

### Phase 5 – Accusation and Solution
- Implement suspect accusation.
- Check the answer on the backend.
- Reveal the solution when permitted.
- Display the final explanation.

### Phase 6 – Testing and Security
- Test all major features.
- Test invalid AI responses.
- Test API security.
- Test solution confidentiality.
- Test responsive layouts.
- Fix errors before release.

## 12. Future Enhancements

Not required for the initial MVP:

- AI-generated crime-scene images.
- Video evidence.
- Audio recordings.
- More mystery categories.
- Multiple difficulty levels.
- Multiplayer investigations.
- Leaderboards.
- User achievements.
- Mystery sharing.

## 13. MVP Acceptance Criteria

The MVP is considered functional when:

1. A user can start a mystery.
2. The application generates a complete fictional case.
3. Suspects and evidence are available.
4. The user can investigate evidence.
5. The user can take notes.
6. The AI assistant can provide useful hints.
7. The user can accuse a suspect.
8. The application checks the accusation correctly.
9. The final solution is revealed only when permitted.
10. The solution explains the clues consistently.
11. API keys and protected solution data are not exposed.
12. The application works on mobile, tablet, and desktop.

## 14. Instructions for AI Coding Agents

Treat this document as the main project specification.

Before writing code:

1. Inspect the existing project files.
2. Explain the current project structure.
3. Identify missing requirements.
4. Suggest a suitable implementation plan.
5. Ask before making major architectural changes.

Development rules:

- Work in small, understandable phases.
- Do not implement the entire application in one step.
- Explain what each file does.
- Explain important code decisions.
- Use readable, maintainable code.
- Do not invent features that contradict this specification.
- Do not invent test results or claim features work without testing.
- Test each phase before proceeding.
- Keep this specification updated when approved requirements change.

**Important:** Build a working MVP first. Do not add advanced features until the basic investigation experience works reliably.