import { prisma } from '../src/lib/prisma';

const departments = [
  "Anaesthesia",
  "Anatomy",
  "Biochemistry",
  "Burn & Plastic Surgery",
  "Cardiology",
  "Cardiothoracic & Vascular Surgery",
  "Dentistry",
  "Dermatology",
  "Endocrinology",
  "ENT",
  "Forensic Medicine and Toxicology",
  "Gastroenterology",
  "General Medicine",
  "General Surgery",
  "Hospital Administration",
  "Medical Oncology/Haematology",
  "Microbiology",
  "Neonatology",
  "Nephrology",
  "Neurology",
  "Neurosurgery",
  "Nuclear Medicine",
  "Nursing",
  "Obstetrics and Gynaecology",
  "Ophthalmology",
  "Orthopaedics",
  "Paediatric Surgery",
  "Paediatrics",
  "Pathology",
  "Pharmacology",
  "Physical Medicine & Rehabilitation",
  "Physiology",
  "Psychiatry",
  "Pulmonary Medicine",
  "Radio Therapy",
  "Radiology",
  "Rheumatology & Clinical Immunology",
  "Surgical Gastroenterology",
  "Surgical Oncology",
  "Transfusion Medicine & Blood Bank",
  "Trauma & Emergency Medicine",
  "Urology"
];

async function main() {
  console.log("Seeding departments...");
  let added = 0;
  for (const name of departments) {
    // create code by taking first 3 letters uppercase, or initials
    const words = name.split(/[\s&]+/);
    let code = words.length === 1 
      ? name.substring(0, 3).toUpperCase() 
      : words.map(w => w[0]).join('').toUpperCase();
      
    // ensure code uniqueness by appending random numbers if needed, but for these it should be mostly fine.
    // actually, let's just use the first 4 chars of the name
    code = name.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    
    // just to be safe from duplicates
    code = code + Math.random().toString(36).substring(2, 4).toUpperCase();

    try {
      await prisma.department.upsert({
        where: { name },
        update: {},
        create: {
          name,
          code
        }
      });
      added++;
    } catch (e) {
      console.log(`Failed to add ${name}`);
      console.error(e);
    }
  }
  console.log(`Successfully added ${added} departments.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
