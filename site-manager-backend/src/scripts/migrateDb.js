const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alfaheem_site_manager';
const TARGET_ADMIN_EMAIL = 'alfaheem.test.tech@gmail.com';
const DEFAULT_PASSWORD = 'admin123';

const collectionMappings = [
  { old: 'site-manager.users', new: 'users' },
  { old: 'site-manager.sites', new: 'sites' },
  { old: 'site-manager.workers', new: 'workers' },
  { old: 'site-manager.dailyattendances', new: 'dailyattendances' },
  { old: 'site-manager.wps', new: 'wps' },
  { old: 'site-manager.advances', new: 'advances' },
  { old: 'site-manager.salaryreports', new: 'salaryreports' }
];

async function runMigration() {
  console.log(`Connecting to MongoDB at: ${MONGO_URI}...`);
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    const db = mongoose.connection.db;
    
    // Get all existing collections in the database
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('\n--- Renaming Prefixed Collections ---');
    for (const mapping of collectionMappings) {
      if (collectionNames.includes(mapping.old)) {
        console.log(`Found prefixed collection: "${mapping.old}"`);
        
        // Check if the standard collection exists
        if (collectionNames.includes(mapping.new)) {
          const docCount = await db.collection(mapping.new).countDocuments();
          if (docCount === 0) {
            console.log(`  Target collection "${mapping.new}" exists but is empty. Dropping it first...`);
            await db.dropCollection(mapping.new);
          } else {
            console.log(`  ⚠️ Warning: Target collection "${mapping.new}" contains ${docCount} documents. Skipping rename to prevent data loss.`);
            continue;
          }
        }

        // Rename collection
        console.log(`  Renaming "${mapping.old}" to "${mapping.new}"...`);
        await db.collection(mapping.old).rename(mapping.new);
        console.log(`  ✅ Successfully renamed "${mapping.old}" to "${mapping.new}".`);
      } else {
        console.log(`Prefixed collection "${mapping.old}" not found. Skipping.`);
      }
    }

    console.log('\n--- Resetting Admin Password ---');
    // Ensure the users collection exists (it should now, after rename)
    const updatedCollections = await db.listCollections().toArray();
    const updatedCollectionNames = updatedCollections.map(c => c.name);

    if (updatedCollectionNames.includes('users')) {
      const usersCollection = db.collection('users');
      const adminUser = await usersCollection.findOne({ email: TARGET_ADMIN_EMAIL });

      if (adminUser) {
        console.log(`Found admin user: ${TARGET_ADMIN_EMAIL}`);
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        
        await usersCollection.updateOne(
          { _id: adminUser._id },
          { 
            $set: { 
              password: hashedPassword,
              resetPasswordToken: undefined,
              resetPasswordExpires: undefined,
              resetOtp: undefined,
              resetOtpExpires: undefined
            } 
          }
        );
        console.log(`✅ Admin password reset successfully.`);
        console.log(`Credentials to use:`);
        console.log(`  Email:    ${TARGET_ADMIN_EMAIL}`);
        console.log(`  Password: ${DEFAULT_PASSWORD}`);
      } else {
        console.log(`❌ Admin user "${TARGET_ADMIN_EMAIL}" not found in the users collection.`);
        console.log('Creating a new admin user...');
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        await usersCollection.insertOne({
          email: TARGET_ADMIN_EMAIL,
          password: hashedPassword,
          refreshTokens: [],
          createdAt: new Date()
        });
        console.log(`✅ Admin user created successfully.`);
        console.log(`Credentials to use:`);
        console.log(`  Email:    ${TARGET_ADMIN_EMAIL}`);
        console.log(`  Password: ${DEFAULT_PASSWORD}`);
      }
    } else {
      console.log('❌ "users" collection does not exist. Cannot reset password.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

runMigration();
