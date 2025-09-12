# Old Estimator Information

This document captures the current Excel-based estimator structure and input prompts that need to be analyzed and potentially integrated into our new digital estimating system.

## Current Excel Sheet Structure

The existing estimator is organized into product item types with specific input prompts. Each row represents a different product category with various input fields for calculations.

### Product Categories and Input Fields

#### Channel Letters
```
Type | Inches/LED | LEDs # | UL | pins | xtra wire | | LED Type | Tfr # | Tfr type
```

#### Vinyl
```
T | Tc | Perf | Perf c | 24" | 24" c | 24" perf | Dig WxH | Dig WxH | Dig WxH
```

#### Substrate Cut
```
Type | XY | Pins | Stnd Off | D-tape | assem | | | | ~ Cut ~
```

#### Backer
```
Alum XYZ | Alum XYZ | Alum XYZ | RW 8" L | RW 8" L | ACM XY | ACM XY | ACM XY | ACM XY | Assem
```

#### Push Thru
```
0Alu/1ACM | Boxes* | XYZ / XY | Acryl XY | LEDs XY | UL | Tfrs | ~ Cut ~ | ~ Assem ~ | ~ Lexan ~
```

#### Blade Sign
```
Circle? | XY | LEDs | Tfrs | UL | | ~ Frame ~ | ~ Assem ~ | ~ Wrap ~ | ~ Cut 2" ~
```

#### LED Neon
```
Base HL | Length | Welds | Stnd Off | Opq? | PVC? | Tfrs | | | ~ Cut$ ~
```

#### Painting
```
Face XY | Face XY | | 3" Ret | 4" Ret | 5" Ret | Trim | | |
```

#### Wiring
```
DCPlug # | DCPlug $ | WallPlug # | WallPlug $ | Extra Wire >> | # Pcs * Len ft | Total ft | ~ $/ft ~ |
```

#### Custom
```
A1 | A2 | A $ | B1 | B2 | B $ | C1 | C2 | C $ |
```

### Special Categories

#### Multiplier
```
Section* | Total* | (Only applies to objects above)
```

#### Discount
```
DC % | DC $ |
```

#### UL (Underwriters Laboratories)
```
UL Base+ | UL +sets | UL $ | | | | UL Base$ | UL $/set |
```

#### Shipping
```
Base | Multi | b | bb | B | BB | Pallet | Crate | Tailgate | #Days |
```

#### Material Cut
```
3in Raw | 3in Prim | 4in | 5in | Trim | PC | ACM | Design | |
```

## Field Layout and Structure

### Excel Layout Details
- **Input Fields**: Columns P to Y, starting from Row 4 and extending down many rows
- **Multiplier Column**: Column Z serves as a multiplier that affects calculations
- **Row Structure**: Each row represents a different line item or product configuration

### Common Field Patterns
- **XY**: Width x Height measurements
- **XYZ**: Width x Height x Depth measurements  
- **#**: Quantity fields
- **$**: Dollar amount fields
- **%**: Percentage fields
- **~ Field ~**: Calculated/derived fields
- **Field***: Fields with multiplier effects
- **Field+**: Base + additional sets
- **Field c**: Color variations
- **Field?**: Boolean/option fields

### Input Categories
1. **Measurements**: XY, XYZ dimensions
2. **Quantities**: LED counts, pins, pieces
3. **Options**: UL listings, materials, colors
4. **Costs**: Direct dollar inputs, rates
5. **Calculations**: Derived fields marked with ~
6. **Multipliers**: Fields that affect other calculations

## Complete Estimator Calculation Formulas

The following are the actual Excel formulas used in the current estimator for ALL product categories. These formulas reference various lookup tables and pricing databases that can be adjusted as needed.

### Key Formula Components

**Note**: These formulas contain references to external lookup tables:
- `'https://d.docs.live.net/EC73E915A68B0A92/SignHouse/[Best Estimator BTS.xlsx]Channel Types'`
- `'https://d.docs.live.net/EC73E915A68B0A92/SignHouse/[Best Estimator BTS.xlsx]LEDs'`
- Various internal pricing tables and references

### Complete Formula Set (All Product Categories)

The following contains the complete set of Excel formulas for all product categories including Channel Letters, Vinyl, Substrate Cut, Backer, Push Thru, Blade Sign, LED Neon, Painting, Custom, Wiring, Discount, Multiplier, UL, Shipping, and Material Cut:

```excel
Channel Letters                                                                                                                                                Vinyl                                                                                            Substrate Cut                                                                    Backer                                                                                                                            Push Thru                                                                                                                                        Blade Sign                                                                                                                            LED Neon                                                                                                    Painting                                                                                    Custom                                        Wiring                                                        Discount                                    Multiplier                            UL                                    Shipping                                                Material Cut                                Prices                    30    20                                            Multiplier    Section    Total    Final                                                                                                                                                                                    
Logic                                            If Item UL <>"", =number or =false. If Customer UL =1, else false             Item TF> Item no UL? (> Customer TF > Default)> Job UL > Default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Face1            Face2            3" return    4" return    5" return    Trimcap        Desc                                                                                DC Plug        Wall Plug        Extra Wire                                        Section            Total                                                                                            =IFS('Estimator V2'!Q4<>"",'Estimator V2'!Q4,$AK$7<>"",$AK$7,1,$C$232)    =$C$228    =$C$229    =$C$230    =$C$231            =$C$233                Lengths                                15    19    15.5    16    10    190    120    30                                                                                                                                                                                                                                        

Previous $    Component        UL Counter    UL# This Item    Type    $/in    in #    Letter Count    Channel $    LEDs #    LED Type    $/LED    LED $    LED Total W    UL Item?    UL job?    UL Item False?    TF Type    TF #    $/TF    TF $    UL$    Pins    Extra Wire                                                                T        Tc        Perf        Perf c        24in        24in c        24in perf        Dig        Dig        Dig                    Material    4x8    Cut    Sqft cut    Sqft mat    Mat $    Cut    Pins    ="StndOff ($" & $K$144 & "/pc)"    Dtape    Assem                            Alum 1    Alum 2    Alum 3    $Alum 1    $Alum 2    $Alum 3    RW 1    RW 2    $RW 1    $RW 1    ACM 1    ACM 2    ACM 3    ACM 4    $ACM 1    $ACM 2    $ACM 3    $ACM 4    Assem                                                    Alu/ACM    Box*    Dims    Alu$    ACM$    Cut    Box$    Acryl Dims    Acryl    Cut    Lexan    Assembly    LEDs #    LED Type    LEDs $    TFs Type    TFs #    TFs $    UL                                                                Circle?    X    Y    Sqft    Blade $    Frame    Assembly    Wrap    Cutting    LEDs #    LED Type    LED $    TFs Type    TFs #    TFs $    UL                                                                PVC/Acryl        Cut    X    Y    Sqft    Base$    LED $/ft    LED W/ft    LED ft    Opq    Cnct$/    Cnct #    LED$    TFs Type    TFs #    TFs $    StndOffs    Stndoffs$                            X    Y    Sqft    X    Y    Sqft    Sqft    Sqft    Sqft    Sqft    Total Sqft    Face1    Face2    3" return    4" return    5" return    Trimcap    Total$                                                        #    $    #    $    Pcs    Len    Total    $/ft                            DC%    DC%$    DC$    DC%    DC%$    DC$                Sectionx    Section$    Totalx    Total$                UL    UL Sets    + sets    + $    Base    Per Set                Base    Multi    b    bb    B    BB    Pallet    Crate    Tailgate                3in Raw    3in Primed    4in    5in    Trim    PC    ACM    Design    3in Raw    3in Primed    4in    5in    Trim    PC    ACM    Design                                                                Space                                                                                                                                                                        

='Estimator V2'!K4:L123    ='Estimator V2'!K4:L123    0    =IF(Z12<>$AB$9,0,IF(AO12,0,AM12*1))    =IF(Z12<>$AB$9,0,IF('Estimator V2'!P4="",$B$58,'Estimator V2'!P4))    =IF(Z12<>$AB$9,0,VLOOKUP('Estimator V2'!$P4,'https://d.docs.live.net/EC73E915A68B0A92/SignHouse/[Best Estimator BTS.xlsx]Channel Types'!$B$3:$D$50,3,FALSE))    =IFERROR(IFS(Z12<>$AB$9,0,'Estimator V2'!Q4="",0,1,LET(array,TEXTSPLIT(SUBSTITUTE('Estimator V2'!Q4," ",""),",",".",TRUE,,),IF(ROWS(array)>1,SUM((TAKE(array,ROWS(array)/2))*1),SUM(array*1)))),IFS(Z12<>$AB$9,0,'Estimator V2'!Q4="",0,1,LET(array,TEXTSPLIT(SUBSTITUTE('Estimator V2'!Q4," ",""),CHAR(9),CHAR(10),TRUE,,),IF(ROWS(array)>1,SUM((TAKE(array,ROWS(array)/2))*1),SUM(array*1)))))    =LET(array,IF(ISNUMBER(SEARCH(CHAR(9),'Estimator V2'!Q4)),TEXTSPLIT(SUBSTITUTE('Estimator V2'!Q4," ",""),CHAR(9),CHAR(10),TRUE,,),TEXTSPLIT(SUBSTITUTE('Estimator V2'!Q4," ",""),",",".",TRUE,,)),COUNT((TAKE(array,ROWS(array)/2))*1))    =IF(Z12<>$AB$9,0,AD12*AE12)    =IF(Z12<>$AB$9,0,LET(array,IF(ISNUMBER(SEARCH(CHAR(9),'Estimator V2'!Q4)),TEXTSPLIT(SUBSTITUTE('Estimator V2'!Q4," ",""),CHAR(9),CHAR(10),TRUE,,),TEXTSPLIT(SUBSTITUTE('Estimator V2'!Q4," ",""),",",".",TRUE,,)),input,'Estimator V2'!$R4,LEDcount,IF(ROWS(array)>1,ROUNDUP(SUM((TAKE(array,-ROWS(array)/2))*1)*XLOOKUP(AC12,$B$58:$B$105,$F$58:$F$105)/0.7,0),0),IFS(input<>"",IF(LOWER(input)="yes",LEDcount,input),NOT($AB$7),0,'Estimator V2'!$Q4<>"",LEDcount,1,ROUNDUP('BTS V2'!AE12*0.7,0))))    =LET(default,'https://d.docs.live.net/EC73E915A68B0A92/SignHouse/[Best Estimator BTS.xlsx]LEDs'!$B$4,ChannelLED,IFERROR(VLOOKUP('Estimator V2'!$P4,$B$58:$C$105,2,FALSE),default),IFS(Z12<>$AB$9,0,'Estimator V2'!$W4<>"",'Estimator V2'!$W4,ChannelLED="Default",IF($AC$7<>"",$AC$7,default),'Estimator V2'!$P4<>"",ChannelLED,1,default))    =IF(Z12<>$AB$9,0,VLOOKUP(AI12,'https://d.docs.live.net/EC73E915A68B0A92/SignHouse/[Best Estimator BTS.xlsx]LEDs'!$C$3:$E$50,2,FALSE))    =IF(Z12<>$AB$9,0,AH12*AJ12)    =IF(Z12<>$AB$9,0,AH12*VLOOKUP(AI12,'https://d.docs.live.net/EC73E915A68B0A92/SignHouse/[Best Estimator BTS.xlsx]LEDs'!$C$3:$E$50,3,FALSE))
```

*[Note: The complete formula text is extremely long and continues with detailed formulas for all product categories including complex calculations for Vinyl, Substrate Cut, Backer, Push Thru, Blade Sign, LED Neon, Painting, Custom work, Wiring, Discounts, Multipliers, UL compliance, Shipping, and Material Cut operations]*

### Key Calculation Patterns Across All Categories
1. **Conditional Processing**: All formulas start with IF statements checking the multiplier column (Z)
2. **Text Parsing**: Complex TEXTSPLIT operations to parse dimension inputs like "12x8,6x4" 
3. **Lookup Tables**: Extensive use of VLOOKUP and XLOOKUP for pricing and specifications
4. **Mathematical Calculations**: ROUNDUP, SUM, PRODUCT functions for material calculations
5. **String Concatenation**: Building description strings for line items
6. **Multi-level Conditionals**: Nested IFS statements handling various product configurations
7. **Array Processing**: LET functions and array operations for complex data manipulation
8. **Cross-category Dependencies**: Formulas reference calculations from other product categories

## Notes for New Implementation

### Analysis Needed
- [ ] Map each field to specific calculation formulas
- [ ] Identify dependencies between fields
- [ ] Document pricing structures behind each category
- [ ] Understand multiplier effects and cascading calculations
- [ ] Map UL and regulatory requirements
- [ ] Document shipping calculation methods

### Questions to Resolve
- [ ] Which fields are manual input vs. calculated?
- [ ] What are the underlying price databases/lookup tables?
- [ ] How do multipliers cascade through the system?
- [ ] What business rules govern each product type?
- [ ] How are material costs and labor factored in?
- [ ] What are the standard markup percentages?

### Integration Considerations
- [ ] How to map to existing job estimation system
- [ ] Database schema requirements for new fields
- [ ] UI/UX design for complex input forms
- [ ] Validation rules for each field type
- [ ] Calculation engine architecture
- [ ] Reporting and output format requirements

## Current System vs. New Requirements

### Existing Job Estimation System
The current digital system has:
- Basic estimate creation and management
- Simple product types and addons
- Group-based organization
- Basic calculation capabilities

### Excel System Advantages
- Comprehensive product coverage
- Detailed input parameters
- Complex calculation relationships
- Industry-specific terminology
- Proven workflow patterns

### Integration Strategy
- [ ] Preserve existing estimate management structure
- [ ] Extend product type system to handle Excel categories
- [ ] Implement dynamic form generation for input fields
- [ ] Create calculation engine for complex formulas
- [ ] Maintain backward compatibility with current estimates