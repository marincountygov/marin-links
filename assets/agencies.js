/*
 * County of Marin agencies and departments.
 * Generated from data/agencies.json by scripts/build-agencies.py. Do not edit.
 * Change the list in data/agencies.json, then run the script.
 */

(() => {
  "use strict";

  // Each department has its divisions, in the list's own order. A division is picked as "department code/division code".
  const AGENCIES = [
    {
      "value": "ag-01",
      "id": "awm",
      "name": "Agriculture, Weights and Measures",
      "divisions": [
        {
          "value": "dv-01",
          "id": "agriculture",
          "name": "Agriculture"
        },
        {
          "value": "dv-02",
          "id": "weights-and-measures",
          "name": "Weights and Measures"
        }
      ]
    },
    {
      "value": "ag-02",
      "id": "arcc",
      "name": "Assessor, Recorder, County Clerk"
    },
    {
      "value": "ag-03",
      "id": "board",
      "name": "Board of Supervisors"
    },
    {
      "value": "ag-04",
      "id": "css",
      "name": "Child Support Services"
    },
    {
      "value": "ag-05",
      "id": "grand-jury",
      "name": "Civil Grand Jury"
    },
    {
      "value": "ag-06",
      "id": "cda",
      "name": "Community Development Agency",
      "divisions": [
        {
          "value": "dv-03",
          "id": "building-and-safety",
          "name": "Building and Safety"
        },
        {
          "value": "dv-04",
          "id": "environmental-health-services",
          "name": "Environmental Health Services"
        },
        {
          "value": "dv-05",
          "id": "planning",
          "name": "Planning"
        },
        {
          "value": "dv-06",
          "id": "housing-and-grants",
          "name": "Housing and Grants Division"
        }
      ]
    },
    {
      "value": "ag-07",
      "id": "county-counsel",
      "name": "County Counsel"
    },
    {
      "value": "ag-08",
      "id": "county-executive",
      "name": "Office of the County Executive"
    },
    {
      "value": "ag-09",
      "id": "cultural-services",
      "name": "Cultural Services"
    },
    {
      "value": "ag-10",
      "id": "da",
      "name": "District Attorney"
    },
    {
      "value": "ag-11",
      "id": "elections",
      "name": "Elections (Registrar of Voters)"
    },
    {
      "value": "ag-12",
      "id": "finance",
      "name": "Department of Finance"
    },
    {
      "value": "ag-13",
      "id": "fire",
      "name": "Fire Department"
    },
    {
      "value": "ag-14",
      "id": "hhs",
      "name": "Health and Human Services",
      "divisions": [
        {
          "value": "dv-07",
          "id": "general-administration",
          "name": "General Administration"
        },
        {
          "value": "dv-08",
          "id": "bhrs",
          "name": "Behavioral Health and Recovery Services"
        },
        {
          "value": "dv-09",
          "id": "homelessness-and-coordinated-care",
          "name": "Homelessness and Coordinated Care"
        },
        {
          "value": "dv-10",
          "id": "public-health",
          "name": "Public Health"
        },
        {
          "value": "dv-11",
          "id": "social-services",
          "name": "Social Services"
        }
      ]
    },
    {
      "value": "ag-15",
      "id": "hr",
      "name": "Human Resources",
      "divisions": [
        {
          "value": "dv-12",
          "id": "classification-compensation",
          "name": "Classification and Compensation"
        },
        {
          "value": "dv-13",
          "id": "employee-benefits-wellness",
          "name": "Employee Benefits and Wellness"
        },
        {
          "value": "dv-14",
          "id": "employee-and-labor-relations",
          "name": "Employee and Labor Relations"
        },
        {
          "value": "dv-15",
          "id": "equal-opportunity",
          "name": "Equal Opportunity"
        },
        {
          "value": "dv-16",
          "id": "internships-and-volunteers",
          "name": "Internships and Volunteers"
        },
        {
          "value": "dv-17",
          "id": "learning-and-organizational-development",
          "name": "Learning and Organizational Development"
        },
        {
          "value": "dv-18",
          "id": "leaves",
          "name": "Leaves"
        },
        {
          "value": "dv-19",
          "id": "recruitment",
          "name": "Recruitment"
        },
        {
          "value": "dv-20",
          "id": "risk-management",
          "name": "Risk Management"
        }
      ]
    },
    {
      "value": "ag-16",
      "id": "ist",
      "name": "Information Services and Technology"
    },
    {
      "value": "ag-17",
      "id": "library",
      "name": "Marin County Free Library"
    },
    {
      "value": "ag-18",
      "id": "parks",
      "name": "Parks"
    },
    {
      "value": "ag-19",
      "id": "probation",
      "name": "Probation"
    },
    {
      "value": "ag-20",
      "id": "public-defender",
      "name": "Public Defender"
    },
    {
      "value": "ag-21",
      "id": "public-works",
      "name": "Public Works"
    },
    {
      "value": "ag-22",
      "id": "retirement",
      "name": "Retirement"
    },
    {
      "value": "ag-23",
      "id": "sheriff",
      "name": "Sheriff"
    },
    {
      "value": "ag-24",
      "id": "tax-collector",
      "name": "Tax Collector"
    },
    {
      "value": "ag-25",
      "id": "uc-extension",
      "name": "UC Cooperative Extension (Farm Advisor)"
    }
  ];

  window.MarinAgencyList = Object.freeze(AGENCIES.map((agency) => Object.freeze({
    ...agency,
    ...(agency.divisions ? { divisions: Object.freeze(agency.divisions.map((division) => Object.freeze(division))) } : {})
  })));
})();
