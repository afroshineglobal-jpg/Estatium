const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Settings
  await prisma.setting.upsert({ where: { key: 'estate_name' }, update: {}, create: { key: 'estate_name', value: 'GreenVille Estate' } });
  await prisma.setting.upsert({ where: { key: 'currency' }, update: {}, create: { key: 'currency', value: '₦' } });
  await prisma.setting.upsert({ where: { key: 'maintenance_charge' }, update: {}, create: { key: 'maintenance_charge', value: '15000' } });
  await prisma.setting.upsert({ where: { key: 'estate_address' }, update: {}, create: { key: 'estate_address', value: '12 Palm Avenue, Lagos' } });

  // Blocks and Units
  const blocks = ['A', 'B', 'C', 'D'];
  const blockMap = {};
  for (const name of blocks) {
    const block = await prisma.block.upsert({ where: { name }, update: {}, create: { name } });
    blockMap[name] = block;
    for (let i = 1; i <= 25; i++) {
      const unitNumber = String(i).padStart(3, '0');
      await prisma.unit.upsert({
        where: { blockId_unitNumber: { blockId: block.id, unitNumber } },
        update: {}, create: { blockId: block.id, unitNumber }
      });
    }
  }

  // Admin user
  const adminPw = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@estate.com' },
    update: {},
    create: { name: 'Estate Admin', email: 'admin@estate.com', password: adminPw, role: 'ADMIN', phone: '+2348001234567' }
  });

  // Security Admin
  const secPw = await bcrypt.hash('Security@123', 12);
  await prisma.user.upsert({
    where: { email: 'security@estate.com' },
    update: {},
    create: { name: 'Security Officer', email: 'security@estate.com', password: secPw, role: 'SECURITY_ADMIN', phone: '+2348001234568' }
  });

  // Finance Admin
  const finPw = await bcrypt.hash('Finance@123', 12);
  await prisma.user.upsert({
    where: { email: 'finance@estate.com' },
    update: {},
    create: { name: 'Finance Manager', email: 'finance@estate.com', password: finPw, role: 'FINANCE_ADMIN', phone: '+2348001234569' }
  });

  // Maintenance Manager
  const maintPw = await bcrypt.hash('Maint@123', 12);
  await prisma.user.upsert({
    where: { email: 'maintenance@estate.com' },
    update: {},
    create: { name: 'Maintenance Manager', email: 'maintenance@estate.com', password: maintPw, role: 'MAINTENANCE_MANAGER', phone: '+2348001234570' }
  });

  // Guard user
  const guardPw = await bcrypt.hash('Guard@123', 12);
  const guardUser = await prisma.user.upsert({
    where: { email: 'guard@estate.com' },
    update: {},
    create: { name: 'Gate Guard', email: 'guard@estate.com', password: guardPw, role: 'GUARD', phone: '+2348001234571' }
  });
  await prisma.guard.upsert({ where: { userId: guardUser.id }, update: {}, create: { userId: guardUser.id, shift: 'MORNING' } });

  // Sample residents
  const sampleResidents = [
    { name: 'Chidi Okeke', email: 'chidi@email.com', phone: '+2348011111111', block: 'A', unit: '001' },
    { name: 'Amaka Obi', email: 'amaka@email.com', phone: '+2348022222222', block: 'A', unit: '002' },
    { name: 'Emeka Nwachukwu', email: 'emeka@email.com', phone: '+2348033333333', block: 'B', unit: '001' },
    { name: 'Ngozi Eze', email: 'ngozi@email.com', phone: '+2348044444444', block: 'B', unit: '002' },
    { name: 'Tunde Adeyemi', email: 'tunde@email.com', phone: '+2348055555555', block: 'C', unit: '001' },
  ];

  for (const r of sampleResidents) {
    const unit = await prisma.unit.findFirst({ where: { unitNumber: r.unit, block: { name: r.block } } });
    if (!unit) continue;
    const pw = await bcrypt.hash('Resident@123', 12);
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { name: r.name, email: r.email, phone: r.phone, password: pw, role: 'RESIDENT' }
    });
    const existing = await prisma.resident.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.resident.create({ data: { userId: user.id, unitId: unit.id, residentType: 'OWNER' } });
      await prisma.unit.update({ where: { id: unit.id }, data: { isOccupied: true } });
    }
  }

  // Amenities
  const amenities = [
    { name: 'Swimming Pool', description: 'Olympic-size pool with lifeguard', capacity: 30, pricePerHour: 2000 },
    { name: 'Community Hall', description: 'Multi-purpose hall for events', capacity: 200, pricePerHour: 5000 },
    { name: 'Tennis Court', description: 'Hard-court tennis court', capacity: 4, pricePerHour: 1500 },
    { name: 'Gym', description: 'Fully equipped fitness center', capacity: 20, pricePerHour: 500 },
    { name: 'Children Playground', description: 'Safe play area for kids', capacity: 50, pricePerHour: 0 },
  ];
  for (const a of amenities) {
    await prisma.amenity.upsert({ where: { name: a.name }, update: {}, create: a }).catch(() => {});
  }

  // Sample notice
  await prisma.notice.create({
    data: { title: 'Welcome to GreenVille Estate!', content: 'Welcome to the GreenVille Estate Management System. Please complete your profile and register your vehicles. For support, contact the admin.', type: 'PUBLIC', postedById: admin.id, isPinned: true }
  }).catch(() => {});

  console.log('\n✅ Seed complete! Default accounts:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 Admin:       admin@estate.com      / Admin@123');
  console.log('🔒 Security:    security@estate.com   / Security@123');
  console.log('💰 Finance:     finance@estate.com    / Finance@123');
  console.log('🔧 Maintenance: maintenance@estate.com/ Maint@123');
  console.log('🚪 Guard:       guard@estate.com      / Guard@123');
  console.log('🏠 Resident 1:  chidi@email.com       / Resident@123');
  console.log('🏠 Resident 2:  amaka@email.com       / Resident@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
