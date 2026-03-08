import { fetchFullProfile } from './server/stockService.ts';

const p = await fetchFullProfile('EMAAR.AE');
console.log('Company keys:', Object.keys(p?.company || {}));
console.log('Officers in company:', p?.company?.officers?.length);
console.log('fullTimeEmployees:', p?.company?.fullTimeEmployees);
if (p?.company?.officers?.length > 0) {
  console.log('First officer:', p.company.officers[0]);
}
