# Changelog

All notable changes to @lls/admin will be documented in this file.

## [0.1.0] - 2026-01-12

### Added

- **Authentication**: Business login via Telegram ID with localStorage persistence
- **Dashboard**: Stats overview (orders today, pending, completed, revenue)
- **Orders Management**: Table view with status filters, order details modal, status updates (accept, prepare, ready, reject)
- **Products Management**: Full CRUD operations, availability toggle, product form modal
- **Settings**: Business info editing (name, address)
- **UI Components**: Button, Input, Card, Table, Modal, Badge, Loading/Skeleton
- **Layout**: Sidebar navigation, Header with logout
- **State Management**: Zustand stores for auth, orders, products
- **API Client**: HTTP client with business auth headers
