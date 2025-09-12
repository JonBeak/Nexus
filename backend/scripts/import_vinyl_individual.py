#!/usr/bin/env python3
"""
Import vinyl inventory via individual MySQL INSERT statements
"""

import subprocess
import re
from datetime import datetime

# Raw inventory data
inventory_data = """3M    3630-005 Ivory [48"]    0.5
3M    3630-005 Ivory [48"]    0.5
3M    3630-005 Ivory [48"]    0.5
3M    3630-005 Ivory [48"]    0.25
3M    3630-015 Yellow [48"]    0.5
3M    3630-015 Yellow [48"]    0.5
3M    3630-015 Yellow [48"]    0.5
3M    3630-025 Sunflower [48"]    1
3M    3630-025 Sunflower [48"]    1
3M    3630-026 Green [48"]    0.5
3M    3630-026 Green [48"]    0.5
3M    3630-033 Red [48"]    0.5
3M    3630-033 Red [48"]    0.5
3M    3630-036 Dark Blue [48"]    1
3M    3630-036 Dark Blue [48"]    0.5
3M    3630-043 Light Tomato Red [48"]    0.75
3M    3630-044 Orange [48"]    1
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-044 Orange [48"]    0.5
3M    3630-049 Burgundy [48"]    0.5
3M    3630-051 Silver Gray [48"]    0.5
3M    3630-051 Silver Gray [48"]    0.5
3M    3630-051 Silver Gray [48"]    0.5
3M    3630-053 Cardinal Red [48"]    0.5
3M    3630-053 Cardinal Red [48"]    0.5
3M    3630-053 Cardinal Red [48"]    0.25
3M    3630-053 Cardinal Red [48"]    0.25
3M    3630-057 Olympic Blue [48"]    1
3M    3630-057 Olympic Blue [48"]    0.67
3M    3630-057 Olympic Blue [48"]    0.5
3M    3630-057 Olympic Blue [48"]    0.5
3M    3630-061 Slate Gray [48"]    2
3M    3630-061 Slate Gray [48"]    0.5
3M    3630-063 Rust Brown [48"]    1
3M    3630-069 Duranodic [48"]    0.25
3M    3630-071 Shadow Gray [48"]    2
3M    3630-073 Dark Red [48"]    0.5
3M    3630-074 Kumquat Orange [48"]    0.5
3M    3630-075 Marigold [48"]    1
3M    3630-075 Marigold [48"]    1
3M    3630-075 Marigold [48"]    1
3M    3630-075 Marigold [48"]    1
3M    3630-075 Marigold [48"]    0.67
3M    3630-075 Marigold [48"]    0.5
3M    3630-075 Marigold [48"]    0.5
3M    3630-075 Marigold [48"]    0.5
3M    3630-076 Holly Green [48"]    0.5
3M    3630-076 Holly Green [48"]    0.5
3M    3630-078 Vivid Rose [48"]    2.5
3M    3630-078 Vivid Rose [48"]    1
3M    3630-078 Vivid Rose [48"]    0.5
3M    3630-084 Tangerine [48"]    0.42
3M    3630-087 Royal Blue [48"]    0.75
3M    3630-097 Bristol Blue [24"]    0.5
3M    3630-097 Bristol Blue [48"]    2
3M    3630-097 Bristol Blue [48"]    0.67
3M    3630-097 Bristol Blue [48"]    0.5
3M    3630-106 Brilliant Green [48"]    1.5
3M    3630-106 Brilliant Green [48"]    0.25
3M    3630-108 Pink [48"]    6
3M    3630-108 Pink [48"]    1
3M    3630-108 Pink [48"]    0.67
3M    3630-108 Pink [48"]    0.5
3M    3630-121 Silver [48"]    0.5
3M    3630-125 Golden Yellow [48"]    1
3M    3630-125 Golden Yellow [48"]    0.5
3M    3630-125 Golden Yellow [48"]    0.5
3M    3630-125 Golden Yellow [48"]    0.5
3M    3630-125 Golden Yellow [48"]    0.5
3M    3630-126 Dark Emerald Green [48"]    0.5
3M    3630-127 Intense Blue [48"]    0.5
3M    3630-128 Plum Purple [48"]    0.75
3M    3630-128 Plum Purple [48"]    0.5
3M    3630-131 Gold Metallic [48"]    1
3M    3630-135 Yellow Rose [48"]    1
3M    3630-136 Lime Green [48"]    3
3M    3630-136 Lime Green [48"]    1
3M    3630-136 Lime Green [48"]    1
3M    3630-141 Gold Nugget [48"]    0.5
3M    3630-146 Light Kelly Green [48"]    0.33
3M    3630-149 Light Beige [48"]    0.5
3M    3630-156 Vivid Green [48"]    1
3M    3630-156 Vivid Green [48"]    0.5
3M    3630-157 Sultan Blue [48"]    1
3M    3630-157 Sultan Blue [48"]    1
3M    3630-157 Sultan Blue [48"]    1
3M    3630-157 Sultan Blue [48"]    1
3M    3630-157 Sultan Blue [48"]    0.5
3M    3630-157 Sultan Blue [48"]    0.25
3M    3630-167 Bright Blue [48"]    0.75
3M    3630-167 Bright Blue [48"]    0.5
3M    3630-167 Bright Blue [48"]    0.5
3M    3630-236 Turquoise [48"]    1
3M    3630-236 Turquoise [48"]    1
3M    3630-236 Turquoise [48"]    1
3M    3630-246 Teal Green [48"]    0.5
3M    3630-246 Teal Green [48"]    0.5
3M    3630-276 KY Blue Grass [48"]    1
3M    3630-276 KY Blue Grass [48"]    0.5
3M    3630-337 Process Blue [48"]    0.5
3M    3630-337 Process Blue [48"]    0.5
3M    3630-337 Process Blue [48"]    0.5
3M    3635-20b Matte White Blockout [48"]    1
3M    3635-210 Dual Colour White [48"]    6
Metamark    MT-600 White [48"]    0.5
Metamark    MT-610 Black [48"]    1
Metamark    MT-640 Light Red [48"]    0.67
Metamark    MT-641 Tomato [48"]    3
Metamark    MT-641 Tomato [48"]    1.33
Metamark    MT-641 Tomato [48"]    0.5
Metamark    MT-641 Tomato [48"]    0.25
Metamark    MT-643 Cardinal [48"]    10
Metamark    MT-643 Cardinal [48"]    8
Metamark    MT-643 Cardinal [48"]    3
Metamark    MT-643 Cardinal [48"]    1
Metamark    MT-643 Cardinal [48"]    1
Metamark    MT-643 Cardinal [48"]    1
Metamark    MT-653 Intense Blue [48"]    1.5
Metamark    MT-660 Lime Green [48"]    0.25
Metamark    MT-666 Turquoise [48"]    1
Metamark    MT-666 Turquoise [48"]    0.67
Metamark    MT-666 Turquoise [48"]    0.25
Metamark    MT-668 Meadow [48"]    0.33
Metamark    MT-668 Meadow [48"]    0.25
Metamark    MT-677 Royal Blue [48"]    6
Metamark    MT-677 Royal Blue [48"]    1.5
Metamark    MT-677 Royal Blue [48"]    1
Avery    PC500-774 Mountain Green Perm KR [48"]    0.33
Avery    PR800-190 Black [48"]    0.5
Avery    PR800-210 Primrose Yellow [48"]    1
Avery    PR800-210 Primrose Yellow [48"]    1
Avery    PR800-210 Primrose Yellow [48"]    1
Avery    PR800-210 Primrose Yellow [48"]    0.25
Avery    PR800-240 Sunflower Yellow [48"]    1
Avery    PR800-240 Sunflower Yellow [48"]    1
Avery    PR800-240 Sunflower Yellow [48"]    1
Avery    PR800-240 Sunflower Yellow [48"]    0.5
Avery    PR800-240 Sunflower Yellow [48"]    0.5
Avery    PR800-240 Sunflower Yellow [48"]    0.33
Avery    PR800-363 Pumpkin Orange [48"]    1.5
Avery    PR800-430 Cardinal Red [48"]    2
Avery    PR800-430 Cardinal Red [48"]    0.67
Avery    PR800-430 Cardinal Red [48"]    0.5
Avery    PR800-430 Cardinal Red [48"]    0.5
Avery    PR800-430 Cardinal Red [48"]    0.125
Avery    PR800-646 Bright Blue [48"]    1
Avery    PR800-646 Bright Blue [48"]    1
Avery    PR800-646 Bright Blue [48"]    0.67
Avery    PR800-672 Sultan Blue [48"]    1
Avery    PR800-672 Sultan Blue [48"]    1
Avery    PR800-672 Sultan Blue [48"]    0.5
Avery    PR800-674 Ultramarine Blue [48"]    1
Avery    PR800-683 Royal Blue [48"]    3
Avery    PR800-683 Royal Blue [48"]    2
Avery    PR800-683 Royal Blue [48"]    1.5
Avery    PR800-683 Royal Blue [48"]    1
Avery    PR800-683 Royal Blue [48"]    0.67
Avery    PR800-683 Royal Blue [48"]    0.5
Avery    PR800-683 Royal Blue [48"]    0.33
Avery    PR800-761 Green Yellow [48"]    2
Avery    PR800-761 Green Yellow [48"]    2
Avery    PR800-761 Green Yellow [48"]    2
Avery    PR800-761 Green Yellow [48"]    1.5
Avery    PR800-761 Green Yellow [48"]    1
Avery    PR800-761 Green Yellow [48"]    1
Avery    PR800-761 Green Yellow [48"]    0.5
Avery    PR800-761 Green Yellow [48"]    0.33
Avery    PR800-781 Medium Green [48"]    2
Avery    PR800-781 Medium Green [48"]    0.5
Avery    PR800-996 Bruin Brown [48"]    2
Avery    PR800-996 Bruin Brown [48"]    1
Avery    SC900-861-W Etchmark [48"]    1
Avery    SC950-103 Clear [48"]    4
Avery    SC950-103 Clear [48"]    3
Avery    SC950-108 Cover White [48"]    1
Avery    SC950-109 White Pearlescent Metallic [48"]    2
Avery    SC950-109 White Pearlescent Metallic [48"]    2
Avery    SC950-180 Matte Black [48"]    1.5
Avery    SC950-190 Gloss Black [48"]    6
Avery    SC950-190 Gloss Black [48"]    1.5
Avery    SC950-190 Gloss Black [48"]    1
Avery    SC950-192 Black Metallic [48"]    1
Avery    SC950-192 Black Metallic [48"]    0.5
Avery    SC950-192 Black Metallic [48"]    0.5
Avery    SC950-192 Black Metallic [48"]    0.25
Avery    SC950-210 Primrose Yellow [24"]    3.5
Avery    SC950-210 Primrose Yellow [48"]    1
Avery    SC950-210 Primrose Yellow [48"]    0.5
Avery    SC950-215 Gold [48"]    0.5
Avery    SC950-220 Canary Yellow [24"]    0.5
Avery    SC950-250 Dark Yellow [48"]    0.5
Avery    SC950-253 Imitation Gold [48"]    1
Avery    SC950-253 Imitation Gold [48"]    1
Avery    SC950-253 Imitation Gold [48"]    0.5
Avery    SC950-405 Hibiscus Red [48"]    1
Avery    SC950-417 Real Red [24"]    2
Avery    SC950-417 Real Red [48"]    1
Avery    SC950-418 Luminous Red [48"]    1
Avery    SC950-418 Luminous Red [48"]    0.5
Avery    SC950-418 Luminous Red [48"]    0.5
Avery    SC950-418 Luminous Red [48"]    0.5
Avery    SC950-425 Tomato Red [24"]    0.5
Avery    SC950-425 Tomato Red [48"]    1
Avery    SC950-430 Cardinal Red [24"]    0.5
Avery    SC950-430 Cardinal Red [48"]    4
Avery    SC950-440 Red [24"]    0.49
Avery    SC950-440 Red [48"]    1
Avery    SC950-445 Fire Red [48"]    2
Avery    SC950-445 Fire Red [48"]    1
Avery    SC950-445 Fire Red [48"]    0.67
Avery    SC950-450 Dark Red [48"]    5
Avery    SC950-450 Dark Red [48"]    1.5
Avery    SC950-460 Spectra Red [48"]    0.5
Avery    SC950-470 Burgundy [48"]    2
Avery    SC950-470 Burgundy [48"]    0.5
Avery    SC950-470 Burgundy [48"]    0.5
Avery    SC950-470 Burgundy [48"]    0.25
Avery    SC950-508 Soft Pink [48"]    2
Avery    SC950-513 Violet [48"]    0.5
Avery    SC950-519 Blush [48"]    2
Avery    SC950-625 Majestic Blue [48"]    0.5
Avery    SC950-628 Egyptian Blue [48"]    0.25
Avery    SC950-630 Olympic Blue [48"]    1
Avery    SC950-640 Light Blue [48"]    0.67
Avery    SC950-652 Butterfly Blue [48"]    3
Avery    SC950-652 Butterfly Blue [48"]    3
Avery    SC950-665 Intence Blue [48"]    3
Avery    SC950-665 Intence Blue [48"]    1.5
Avery    SC950-678 Ocean Blue [24"]    1
Avery    SC950-678 Ocean Blue [48"]    0.75
Avery    SC950-679 Reflex Blue [48"]    7.5
Avery    SC950-679 Reflex Blue [48"]    0.5
Avery    SC950-680 Sapphire Blue [48"]    1
Avery    SC950-683 Royal Blue [24"]    5
Avery    SC950-683 Royal Blue [48"]    3
Avery    SC950-760 Apple Green [48"]    0.33
Avery    SC950-765 Olive Green [48"]    10
Avery    SC950-765 Olive Green [48"]    0.33
Avery    SC950-775 Bright Green [48"]    10
Avery    SC950-778 Green [48"]    3
Avery    SC950-778 Green [48"]    2
Avery    SC950-778 Green [48"]    2
Avery    SC950-780 Yellow Green [48"]    1
Avery    SC950-780 Yellow Green [48"]    0.5
Avery    SC950-783 ??????? [48"]    0.25
Avery    SC950-785 Forest Green [48"]    1
Avery    SC950-790 Deep Green [48"]    0.5
Avery    SC950-793 Dark Green [48"]    2
Avery    SC950-810 Light Gray [48"]    3
Avery    SC950-810 Light Gray [48"]    2
Avery    SC950-810 Light Gray [48"]    0.5
Avery    SC950-820 Palm Oyster [24"]    0.5
Avery    SC950-820 Palm Oyster [24"]    0.5
Avery    SC950-820 Palm Oyster [48"]    4
Avery    SC950-820 Palm Oyster [48"]    3
Avery    SC950-820 Palm Oyster [48"]    3
Avery    SC950-825 Light Ash Grey [24"]    1
Avery    SC950-825 Light Ash Grey [24"]    0.5
Avery    SC950-830 Slate Grey [48"]    2
Avery    SC950-853 ?????? [48"]    1
Avery    SC950-855 Dark Gray [48"]    1
Avery    SC950-862 ?????? [48"]    2
Avery    SC950-869 Light Silver [48"]    0.25
Avery    SC950-870 Battleship Gray [48"]    1.5
Avery    SC950-870 Battleship Gray [48"]    1
Avery    SC950-870 Battleship Gray [48"]    0.5
Avery    SC950-920 Beige [24"]    1.5
Avery    SC950-920 Beige [48"]    2
Avery    SC950-920 Beige [48"]    2
Avery    SC950-920 Beige [48"]    2
Avery    SC950-920 Beige [48"]    0.25
Avery    SC950-921 Dark Beige [48"]    0.5
Avery    SC950-921 Dark Beige [48"]    0.5
Avery    SC950-965 Sandstone [48"]    8
Avery    SC950-965 Sandstone [48"]    0.5
Avery    SC950-970 Buckskin [48"]    2
Avery    SC950-990 Chocolate Brown [48"]    2
Avery    SF100-841-S Brushed Chrome [24"]    0.5
Avery    SW900 ????-807 ?????? [48"]    1
Avery    UC900-101 White [48"]    1.5
Avery    UC900-101 White [48"]    0.5
Avery    UC900-148 White 60% Diffuser [48"]    1
Avery    UC900-181 Onyx [48"]    0.33
Avery    UC900-198 Dark Roast [48"]    7
Avery    UC900-214 Yellow Jacket [48"]    0.5
Avery    UC900-214 Yellow Jacket [48"]    0.5
Avery    UC900-214 Yellow Jacket [48"]    0.25
Avery    UC900-216 Sunshine Yellow [48"]    1
Avery    UC900-216 Sunshine Yellow [48"]    1
Avery    UC900-216 Sunshine Yellow [48"]    0.75
Avery    UC900-216 Sunshine Yellow [48"]    0.5
Avery    UC900-216 Sunshine Yellow [48"]    0.5
Avery    UC900-216 Sunshine Yellow [48"]    0.25
Avery    UC900-216 Sunshine Yellow [48"]    0.25
Avery    UC900-216 Sunshine Yellow [48"]    0.25
Avery    UC900-243 Marigold [48"]    2
Avery    UC900-243 Marigold [48"]    1
Avery    UC900-243 Marigold [48"]    0.5
Avery    UC900-250 ?????? [48"]    1
Avery    UC900-254 Vivid Gold [48"]    1
Avery    UC900-254 Vivid Gold [48"]    0.33
Avery    UC900-360 Orange [48"]    1.5
Avery    UC900-360 Orange [48"]    0.5
Avery    UC900-360 Orange [48"]    0.5
Avery    UC900-360 Orange [48"]    0.5
Avery    UC900-360 Orange [48"]    0.5
Avery    UC900-360 Orange [48"]    0.25
Avery    UC900-361 Goldfish Orange [48"]    0.5
Avery    UC900-361 Goldfish Orange [48"]    0.25
Avery    UC900-408 Coral Red [24"]    0.5
Avery    UC900-408 Coral Red [48"]    1
Avery    UC900-408 Coral Red [48"]    0.67
Avery    UC900-408 Coral Red [48"]    0.5
Avery    UC900-408 Coral Red [48"]    0.5
Avery    UC900-408 Coral Red [48"]    0.5
Avery    UC900-408 Coral Red [48"]    0.5
Avery    UC900-408 Coral Red [48"]    0.33
Avery    UC900-408 Coral Red [48"]    0.33
Avery    UC900-408 Coral Red [48"]    0.33
Avery    UC900-408 Coral Red [48"]    0.25
Avery    UC900-424 Light Tomato Red [48"]    0.5
Avery    UC900-424 Light Tomato Red [48"]    0.5
Avery    UC900-424 Light Tomato Red [48"]    0.5
Avery    UC900-424 Light Tomato Red [48"]    0.33
Avery    UC900-424 Light Tomato Red [48"]    0.25
Avery    UC900-424 Light Tomato Red [48"]    0.25
Avery    UC900-427 Imperial Red [48"]    1
Avery    UC900-427 Imperial Red [48"]    1
Avery    UC900-427 Imperial Red [48"]    1
Avery    UC900-427 Imperial Red [48"]    1
Avery    UC900-427 Imperial Red [48"]    1
Avery    UC900-427 Imperial Red [48"]    1
Avery    UC900-427 Imperial Red [48"]    0.75
Avery    UC900-427 Imperial Red [48"]    0.5
Avery    UC900-427 Imperial Red [48"]    0.5
Avery    UC900-427 Imperial Red [48"]    0.5
Avery    UC900-434 Vivid Red [48"]    1
Avery    UC900-434 Vivid Red [48"]    0.5
Avery    UC900-434 Vivid Red [48"]    0.5
Avery    UC900-434 Vivid Red [48"]    0.5
Avery    UC900-440 Red [24"]    2
Avery    UC900-440 Red [48"]    0.67
Avery    UC900-440 Red [48"]    0.66
Avery    UC900-440 Red [48"]    0.5
Avery    UC900-440 Red [48"]    0.5
Avery    UC900-440 Red [48"]    0.33
Avery    UC900-440 Red [48"]    0.25
Avery    UC900-468 Wine Red [48"]    2
Avery    UC900-468 Wine Red [48"]    1
Avery    UC900-468 Wine Red [48"]    0.5
Avery    UC900-470 Burgundy [48"]    1.5
Avery    UC900-470 Burgundy [48"]    0.33
Avery    UC900-470 Burgundy [48"]    0.25
Avery    UC900-516 Fuchsia [48"]    1
Avery    UC900-516 Fuchsia [48"]    0.5
Avery    UC900-516 Fuchsia [48"]    0.5
Avery    UC900-516 Fuchsia [48"]    0.5
Avery    UC900-516 Fuchsia [48"]    0.5
Avery    UC900-546 Plum [48"]    2
Avery    UC900-546 Plum [48"]    1.5
Avery    UC900-546 Plum [48"]    1
Avery    UC900-546 Plum [48"]    1
Avery    UC900-546 Plum [48"]    1
Avery    UC900-546 Plum [48"]    0.67
Avery    UC900-546 Plum [48"]    0.5
Avery    UC900-546 Plum [48"]    0.5
Avery    UC900-546 Plum [48"]    0.25
Avery    UC900-560 Bright Purple [48"]    2
Avery    UC900-560 Bright Purple [48"]    1.5
Avery    UC900-560 Bright Purple [48"]    1.5
Avery    UC900-560 Bright Purple [48"]    1
Avery    UC900-560 Bright Purple [48"]    1
Avery    UC900-560 Bright Purple [48"]    0.5
Avery    UC900-560 Bright Purple [48"]    0.5
Avery    UC900-602 Pearl Blue [48"]    0.5
Avery    UC900-603 Cornflower Blue [48"]    0.5
Avery    UC900-603 Cornflower Blue [48"]    0.5
Avery    UC900-603 Cornflower Blue [48"]    0.33
Avery    UC900-619 Bright Teal [48"]    1.5
Avery    UC900-619 Bright Teal [48"]    1
Avery    UC900-619 Bright Teal [48"]    1
Avery    UC900-619 Bright Teal [48"]    1
Avery    UC900-619 Bright Teal [48"]    0.5
Avery    UC900-619 Bright Teal [48"]    0.5
Avery    UC900-626 French Blue [48"]    5
Avery    UC900-661 Capri Blue [48"]    2
Avery    UC900-661 Capri Blue [48"]    1.5
Avery    UC900-661 Capri Blue [48"]    1.5
Avery    UC900-661 Capri Blue [48"]    1.5
Avery    UC900-661 Capri Blue [48"]    1
Avery    UC900-661 Capri Blue [48"]    0.67
Avery    UC900-661 Capri Blue [48"]    0.5
Avery    UC900-661 Capri Blue [48"]    0.5
Avery    UC900-661 Capri Blue [48"]    0.5
Avery    UC900-668 Island Blue [48"]    1
Avery    UC900-668 Island Blue [48"]    0.5
Avery    UC900-668 Island Blue [48"]    0.33
Avery    UC900-683 ??????? [48"]    0.5
Avery    UC900-684 Deep Sea Blue [48"]    2.5
Avery    UC900-684 Deep Sea Blue [48"]    2
Avery    UC900-684 Deep Sea Blue [48"]    1
Avery    UC900-684 Deep Sea Blue [48"]    1
Avery    UC900-684 Deep Sea Blue [48"]    1
Avery    UC900-684 Deep Sea Blue [48"]    0.5
Avery    UC900-684 Deep Sea Blue [48"]    0.5
Avery    UC900-684 Deep Sea Blue [48"]    0.25
Avery    UC900-685 Ultramarine [48"]    3
Avery    UC900-685 Ultramarine [48"]    3
Avery    UC900-685 Ultramarine [48"]    1
Avery    UC900-685 Ultramarine [48"]    1
Avery    UC900-685 Ultramarine [48"]    1
Avery    UC900-685 Ultramarine [48"]    1
Avery    UC900-685 Ultramarine [48"]    1
Avery    UC900-685 Ultramarine [48"]    1
Avery    UC900-685 Ultramarine [48"]    0.67
Avery    UC900-685 Ultramarine [48"]    0.67
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.5
Avery    UC900-685 Ultramarine [48"]    0.33
Avery    UC900-685 Ultramarine [48"]    0.33
Avery    UC900-685 Ultramarine [48"]    0.25
Avery    UC900-686 Cobalt Blue [48"]    1.33
Avery    UC900-686 Cobalt Blue [48"]    1
Avery    UC900-686 Cobalt Blue [48"]    1
Avery    UC900-686 Cobalt Blue [48"]    0.67
Avery    UC900-686 Cobalt Blue [48"]    0.67
Avery    UC900-686 Cobalt Blue [48"]    0.5
Avery    UC900-686 Cobalt Blue [48"]    0.5
Avery    UC900-686 Cobalt Blue [48"]    0.5
Avery    UC900-686 Cobalt Blue [48"]    0.5
Avery    UC900-686 Cobalt Blue [48"]    0.33
Avery    UC900-691 Twilight Blue [48"]    2
Avery    UC900-691 Twilight Blue [48"]    1
Avery    UC900-691 Twilight Blue [48"]    1
Avery    UC900-691 Twilight Blue [48"]    0.33
Avery    UC900-691 Twilight Blue [48"]    0.33
Avery    UC900-692 Real Blue [48"]    2
Avery    UC900-692 Real Blue [48"]    0.5
Avery    UC900-692 Real Blue [48"]    0.25
Avery    UC900-693 Neptune Blue [48"]    1.5
Avery    UC900-693 Neptune Blue [48"]    1
Avery    UC900-693 Neptune Blue [48"]    0.33
Avery    UC900-722 Amazonite Teal [48"]    1
Avery    UC900-722 Amazonite Teal [48"]    1
Avery    UC900-722 Amazonite Teal [48"]    0.5
Avery    UC900-722 Amazonite Teal [48"]    0.5
Avery    UC900-726 Bright Green [48"]    1
Avery    UC900-726 Bright Green [48"]    0.5
Avery    UC900-734 Citrus Green [48"]    1.5
Avery    UC900-734 Citrus Green [48"]    1
Avery    UC900-734 Citrus Green [48"]    0.5
Avery    UC900-762 Palm Green [48"]    1
Avery    UC900-762 Palm Green [48"]    1
Avery    UC900-762 Palm Green [48"]    0.75
Avery    UC900-762 Palm Green [48"]    0.5
Avery    UC900-762 Palm Green [48"]    0.5
Avery    UC900-762 Palm Green [48"]    0.5
Avery    UC900-762 Palm Green [48"]    0.5
Avery    UC900-762 Palm Green [48"]    0.25
Avery    UC900-783 Safari Green [48"]    1
Avery    UC900-783 Safari Green [48"]    0.5
Avery    UC900-792 Holly Green [48"]    2
Avery    UC900-792 Holly Green [48"]    2
Avery    UC900-792 Holly Green [48"]    0.67
Avery    UC900-792 Holly Green [48"]    0.5
Avery    UC900-837 Cement Grey [48"]    1
Avery    UC900-837 Cement Grey [48"]    1
Avery    UC900-837 Cement Grey [48"]    0.5
Avery    UC900-869 Light Silver [48"]    3
Avery    UC900-869 Light Silver [48"]    0.5
Avery    UC900-869 Light Silver [48"]    0.5
Avery    UC900-869 Light Silver [48"]    0.33
Avery    Avery Placeholder [48"]    1
3M    3M Placeholder [48"]    1
Metamark    Metamark Placeholder [48"]    1
3M    3630-044 Orange [48"]    1
3M    3630-051 Silver Gray [48"]    2
3M    3630-061 Slate Gray [48"]    0.5
3M    3630-061 Slate Gray [48"]    0.75
3M    3630-076 Holly Green [48"]    0.67
3M    3630-078 Vivid Rose [48"]    1
3M    3630-097 Bristol Blue [24"]    0.5
3M    3630-106 Brilliant Green [48"]    0.5
3M    3630-106 Brilliant Green [48"]    0.5
3M    3630-115 Light Lemon Yellow [48"]    2
3M    3630-143 Poppy Red [24"]    2.99
3M    3630-106 Brilliant Green [48"]    0.25
Avery    UC900-214 Yellow Jacket [48"]    1
3M    3630-115 Light Lemon Yellow [48"]    2
Avery    UC900-685 Ultramarine [25"]    3
3M    3630-073 Dark Red [48"]    0.75
3M    3635-222 Dual Colour Black [48"]    0.5
3M    3630-136 Lime Green [48"]    1
3M    3630-038 Fuchsia [48"]    0.5
Avery    UC900-440 Red [48"]    0.33
3M    3630-087 Royal Blue [48"]    3
Avery    PR800-683 Royal Blue [48"]    2.5
3M    3635-210 Dual Colour White PRINTED BLACK [48"]    1
3M    3630-057 Olympic Blue [48"]    3
3M    3635-222 Dual Colour Black [48"]    3
3M    3630-043 Light Tomato Red [48"]    1"""

def parse_vinyl_line(line):
    """Parse a single line of vinyl data"""
    line = line.strip()
    if not line:
        return None
    
    pattern = r'^([^\s]+)\s+([^\s]+)\s+(.+?)\s+\[(\d+)"\]\s+([0-9.]+)$'
    match = re.match(pattern, line)
    
    if not match:
        return None
    
    brand, series, colour, width, length = match.groups()
    
    # Clean up colour name
    colour = colour.strip()
    if '???????' in colour or '????' in colour:
        colour = colour.replace('???????', 'Unknown Color').replace('??????', 'Unknown Color').replace('????', 'Unknown Color')
    
    if 'PRINTED BLACK' in colour:
        colour = colour.replace(' PRINTED BLACK', '')
    
    return {
        'brand': brand,
        'series': series,
        'colour': colour,
        'width': int(width),
        'length_yards': float(length)
    }

def execute_mysql(query):
    """Execute MySQL query"""
    try:
        result = subprocess.run(
            ['sudo', 'mysql', 'sign_manufacturing', '-e', query],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, '', str(e)

def main():
    print("🚀 Importing vinyl inventory via individual database inserts...")
    
    lines = inventory_data.strip().split('\n')
    vinyl_items = []
    products = set()
    
    print("📝 Parsing vinyl data...")
    for line in lines:
        parsed = parse_vinyl_line(line)
        if parsed:
            vinyl_items.append(parsed)
            products.add((parsed['brand'], parsed['series'], parsed['colour'], parsed['width']))
    
    print(f"✅ Parsed {len(vinyl_items)} vinyl items and {len(products)} unique products")
    
    # Create products first
    print("📦 Creating product catalog entries...")
    product_success = 0
    for brand, series, colour, width in products:
        query = f"""
        INSERT IGNORE INTO vinyl_products (brand, series, colour, default_width, is_active, created_at, updated_at) 
        VALUES ('{brand.replace("'", "''")}', '{series.replace("'", "''")}', '{colour.replace("'", "''")}', {width}, 1, NOW(), NOW());
        """
        
        success, stdout, stderr = execute_mysql(query)
        if success:
            product_success += 1
        else:
            print(f"  ❌ Product error: {brand} {series} {colour} - {stderr}")
    
    print(f"✅ Created {product_success}/{len(products)} products")
    
    # Create inventory items
    print("📋 Creating inventory entries...")
    inventory_success = 0
    
    for i, item in enumerate(vinyl_items, 1):
        query = f"""
        INSERT INTO vinyl_inventory (brand, series, colour, width, length_yards, disposition, storage_date, location, created_at, updated_at) 
        VALUES ('{item['brand'].replace("'", "''")}', '{item['series'].replace("'", "''")}', '{item['colour'].replace("'", "''")}', 
                {item['width']}, {item['length_yards']}, 'in_stock', CURDATE(), 'Storage', NOW(), NOW());
        """
        
        success, stdout, stderr = execute_mysql(query)
        if success:
            inventory_success += 1
        else:
            print(f"  ❌ Inventory error {i}: {item['brand']} {item['series']} {item['colour']} - {stderr}")
        
        # Progress update
        if i % 100 == 0:
            print(f"  📊 Progress: {i}/{len(vinyl_items)} ({inventory_success} successful)")
    
    print(f"\n🎯 Import completed!")
    print(f"✅ Products: {product_success}/{len(products)}")
    print(f"✅ Inventory: {inventory_success}/{len(vinyl_items)}")
    
    # Verify results
    print("🔍 Verifying import...")
    success, stdout, stderr = execute_mysql("SELECT COUNT(*) FROM vinyl_products WHERE is_active = 1;")
    if success:
        print(f"📦 Total products in catalog: {stdout.strip().split()[-1]}")
    
    success, stdout, stderr = execute_mysql("SELECT COUNT(*) FROM vinyl_inventory WHERE disposition = 'in_stock';")
    if success:
        print(f"📋 Total inventory items: {stdout.strip().split()[-1]}")

if __name__ == "__main__":
    main()