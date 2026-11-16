import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { RiskPage } from './RiskPage';
import type { DdriveBarangayProfile, DdriveCityScore, DdriveRiskMatrixRow } from '@/types';

const matrix=(ranking:number,band:string,label:string):DdriveRiskMatrixRow=>({severity_min:26,severity_max:50,likelihood_min:8.1,likelihood_max:10,ranking,band,label});

describe('RiskPage — DDRiVE and source-aligned barangay flood exposure',()=>{
 it('shows computed city band, barangay profile and matching population flood detail',async()=>{
  await db.ddrive_city_scores.bulkPut([{hazard_event:'Riverine & flash flood',hazard_family:'H2 Hydrological',exposure_infrastructure:null,exposure_productive:null,exposure_essential:null,exposure_human:null,vulnerability_rating:90,response_measures:null,likelihood:9,severity:50,evidence_anchor:'Largest modelled exposure',validation_status:'Desk score'} satisfies DdriveCityScore]);
  await db.ddrive_risk_matrix.bulkPut([matrix(15,'H7','High'),{severity_min:0,severity_max:10,likelihood_min:0,likelihood_max:2,ranking:1,band:'VL1',label:'Very Low'}]);
  await db.ddrive_barangay_profiles.bulkPut([{psgc:'0803738057',name:'Lao',former_name:null,urban_rural:'Rural',population_2024:4456,population_2020:4374,growth_rate_2020_2024:0.001,households:null,density_per_ha:null,data_quality_flag:null,lat:11.03,lng:124.53,coord_source:null,coord_validation:null,cluster_no:null,cluster_label:null,district_zone:null,assigned_coordinator:null,cluster_validation:null,workbook_rev:'v1.2'} satisfies DdriveBarangayProfile]);
  render(<MemoryRouter><RiskPage/></MemoryRouter>);
  expect(await screen.findByText('Riverine & flash flood')).toBeTruthy();
  expect(await screen.findByText('H · High')).toBeTruthy();
  expect(await screen.findByText('Lao')).toBeTruthy();
  expect(await screen.findByText(/Flood-prone 4,226 \/ 4,374/)).toBeTruthy();
  expect(await screen.findByText(/96\.616%/)).toBeTruthy();
 });
});
