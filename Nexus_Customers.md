# Nexus Customer Management System



## Feature Overview
Full CRUD with multi-address support (644+ customers, communication prefs, history tracking)

## Business Domain Rules
<Rule name="CustomerAddresses">Support billing, shipping, and multiple jobsite addresses with full audit trail</Rule>
<Rule name="CustomerPreferences">Each customer has manufacturing preferences, communication settings, and pricing history</Rule>


### Customer Preferences
Each customer has manufacturing preferences, communication settings, and pricing history

## Routes
- `/customers` - Customer management with addresses and preferences

## Architecture Notes
- Customer data integrates with tax calculation system
- Multi-address support with audit trail
- Communication preferences stored per customer
- Pricing history maintained for business insights