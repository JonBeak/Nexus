<ArchitectureReference>
    <File>See /home/jon/Nexus/Future Grid Base Architecture.md for complete layered grid architecture specification</File>
    <Usage>Reference for GridJobBuilder refactoring, layered calculation system, and performance optimizations</Usage>
    <Scope>Base layer foundation - Core types, relationship calculations, display layer, interaction layer, GridEngine orchestrator</Scope>
    <HighLevelOverview>
        Base layer is set up so input can be received in the input grid about job details.
        Input is put in 
</ArchitectureReference>


<Rule name="EstimationWorkflow">Job estimates use 10-column dynamic grid system with assembly groupings, flexible field validation, and immutable versioning</Rule>
<Rule name="VersionControl">Once estimates are finalized (sent/approved/ordered), they become immutable for audit compliance</Rule>
<Rule name="JobHierarchy">Customer → Jobs → Estimate Versions with automatic version numbering and conflict prevention</Rule>
<Rule name="GridSystem">Products configured in 10-column flexible grid with continuation rows, sub-items, and colored assembly groupings</Rule>
<Rule name="AssemblyGroups">Visual organization system using colored groupings (10 colors: purple, blue, green, orange, pink, cyan, red, yellow, indigo, emerald) with user-defined assembly costs</Rule>
<Rule name="DataPersistence">✅ Grid data stored as flat items structure with assembly_group references, supporting parent-child relationships and flexible string-based validation</Rule>
<Rule name="DynamicTemplates">✅ Product field options populated from inventory database instead of hardcoded JSON</Rule>
<Rule name="ValidationSystem">✅ Comprehensive useGridValidation hook with field-level validation, red borders, error tooltips - purely informational, never blocks saves</Rule>
<Rule name="AutoSave">✅ Grid changes auto-saved with unsaved indicator + confirmation for destructive actions</Rule>
<Rule name="EstimatePreview">✅ EstimateTable uses assembly logic with multi-row support and validation error overlays</Rule>