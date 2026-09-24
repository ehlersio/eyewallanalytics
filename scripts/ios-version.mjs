#!/usr/bin/env node
// scripts/ios-version.mjs — `npm run ios:version`, run when cutting an iOS
// build for TestFlight/App Store.
//
// package.json's version is the app's one version number (bumped on every
// merge to main by .github/workflows/version.yml). This copies it into the
// Xcode project's MARKETING_VERSION and adds one to CURRENT_PROJECT_VERSION
// -- App Store Connect needs a higher build number for every upload, even
// of the same version. Every build configuration and target is updated, so
// they can't drift apart.
import { readFileSync, writeFileSync } from 'node:fs';

const PBXPROJ = new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

let project = readFileSync(PBXPROJ, 'utf8');
const builds = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(m => Number(m[1]));
if (!builds.length) throw new Error('No CURRENT_PROJECT_VERSION in project.pbxproj');
const build = Math.max(...builds) + 1;

project = project
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
writeFileSync(PBXPROJ, project);

console.log(`iOS ${version} (build ${build})`);
