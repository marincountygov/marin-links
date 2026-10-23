/*
 * County of Marin agencies and departments.
 * Generated from data/agencies.json by scripts/build-agencies.py. Do not edit.
 * Change the list in data/agencies.json, then run the script.
 */

(() => {
  "use strict";

  // Each department has its divisions, in the list's own order. A division is picked as "department/division".
  const AGENCIES = [
    {
      "value": "awm",
      "name": "Agriculture, Weights and Measures",
      "divisions": [
        {
          "value": "agriculture",
          "name": "Agriculture"
        },
        {
          "value": "weights-and-measures",
          "name": "Weights and Measures"
        }
      ]
    },
    {
      "value": "arcc",
      "name": "Assessor, Recorder, County Clerk"
    },
    {
      "value": "board",
      "name": "Board of Supervisors"
    },
    {
      "value": "css",
      "name": "Child Support Services"
    },
    {
      "value": "grand-jury",
      "name": "Civil Grand Jury"
    },
    {
      "value": "cda",
      "name": "Community Development Agency",
      "divisions": [
        {
          "value": "building-and-safety",
          "name": "Building and Safety"
        },
        {
          "value": "environmental-health-services",
          "name": "Environmental Health Services"
        },
        {
          "value": "planning",
          "name": "Planning"
        },
        {
          "value": "housing-and-grants",
          "name": "Housing and Grants Division"
        }
      ]
    },
    {
      "value": "county-counsel",
      "name": "County Counsel"
    },
    {
      "value": "county-executive",
      "name": "Office of the County Executive"
    },
    {
      "value": "cultural-services",
      "name": "Cultural Services"
    },
    {
      "value": "da",
      "name": "District Attorney"
    },
    {
      "value": "elections",
      "name": "Elections (Registrar of Voters)"
    },
    {
      "value": "finance",
      "name": "Department of Finance"
    },
    {
      "value": "fire",
      "name": "Fire Department"
    },
    {
      "value": "hhs",
      "name": "Health and Human Services",
      "divisions": [
        {
          "value": "general-administration",
          "name": "General Administration"
        },
        {
          "value": "bhrs",
          "name": "Behavioral Health and Recovery Services"
        },
        {
          "value": "homelessness-and-coordinated-care",
          "name": "Homelessness and Coordinated Care"
        },
        {
          "value": "public-health",
          "name": "Public Health"
        },
        {
          "value": "social-services",
          "name": "Social Services"
        }
      ]
    },
    {
      "value": "hr",
      "name": "Human Resources",
      "divisions": [
        {
          "value": "classification-compensation",
          "name": "Classification and Compensation"
        },
        {
          "value": "employee-benefits-wellness",
          "name": "Employee Benefits and Wellness"
        },
        {
          "value": "employee-and-labor-relations",
          "name": "Employee and Labor Relations"
        },
        {
          "value": "equal-opportunity",
          "name": "Equal Opportunity"
        },
        {
          "value": "internships-and-volunteers",
          "name": "Internships and Volunteers"
        },
        {
          "value": "learning-and-organizational-development",
          "name": "Learning and Organizational Development"
        },
        {
          "value": "leaves",
          "name": "Leaves"
        },
        {
          "value": "recruitment",
          "name": "Recruitment"
        },
        {
          "value": "risk-management",
          "name": "Risk Management"
        }
      ]
    },
    {
      "value": "ist",
      "name": "Information Services and Technology"
    },
    {
      "value": "library",
      "name": "Marin County Free Library"
    },
    {
      "value": "parks",
      "name": "Parks"
    },
    {
      "value": "probation",
      "name": "Probation"
    },
    {
      "value": "public-defender",
      "name": "Public Defender"
    },
    {
      "value": "public-works",
      "name": "Public Works"
    },
    {
      "value": "retirement",
      "name": "Retirement"
    },
    {
      "value": "sheriff",
      "name": "Sheriff"
    },
    {
      "value": "tax-collector",
      "name": "Tax Collector"
    },
    {
      "value": "uc-extension",
      "name": "UC Cooperative Extension (Farm Advisor)"
    }
  ];

  window.MarinAgencyList = Object.freeze(AGENCIES.map((agency) => Object.freeze({
    ...agency,
    ...(agency.divisions ? { divisions: Object.freeze(agency.divisions.map((division) => Object.freeze(division))) } : {})
  })));
})();
