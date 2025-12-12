# Contributing to SAK WhatsApp API

Thank you for considering contributing to SAK WhatsApp API! This document provides guidelines for contributions.

## 🤝 How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/YOUR_USERNAME/SAK-WhatsApp-API/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check existing issues to avoid duplicates
2. Create a new issue with:
   - Clear feature description
   - Use case explanation
   - Potential implementation approach
   - Any relevant examples

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes following our coding standards
4. Write/update tests if applicable
5. Update documentation as needed
6. Commit with clear messages: `git commit -m "Add feature: description"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a Pull Request with:
   - Clear title and description
   - Link to related issues
   - Screenshots for UI changes

## 📝 Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow existing code style
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

### Backend
- Follow RESTful API conventions
- Use async/await for asynchronous operations
- Implement proper error handling
- Add logging for important operations
- Write descriptive API documentation

### Frontend
- Use functional components with hooks
- Follow component structure in existing files
- Use TailwindCSS for styling
- Keep components reusable
- Handle loading and error states

### Database
- Write reversible migrations
- Add indexes for performance
- Use foreign keys for relationships
- Document schema changes

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

## 📋 Commit Messages

Use clear, descriptive commit messages:

- `feat: Add webhook retry mechanism`
- `fix: Resolve session reconnection issue`
- `docs: Update API documentation`
- `refactor: Simplify authentication middleware`
- `test: Add unit tests for message service`
- `chore: Update dependencies`

## 🔍 Code Review Process

1. All PRs require at least one review
2. Address review comments promptly
3. Keep PR scope focused and manageable
4. Ensure CI checks pass

## 📚 Development Setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/SAK-WhatsApp-API.git
cd SAK-WhatsApp-API

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Setup database
createdb sak_whatsapp_api
npx knex migrate:latest

# Start development
npm run dev
```

## 🎯 Priority Areas

Current focus areas where contributions are especially welcome:

1. **Testing**: Unit and integration tests
2. **Documentation**: API examples and guides
3. **Performance**: Optimization and caching
4. **Features**: Scheduled messages, message templates
5. **Security**: Enhanced authentication, audit logs

## 💬 Communication

- GitHub Issues: Bug reports and feature requests
- Pull Requests: Code contributions
- Discussions: General questions and ideas

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## ❓ Questions?

Feel free to ask questions by creating an issue or reaching out to maintainers.

Thank you for contributing! 🎉
