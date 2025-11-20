<BuildManagementGuide>
  <Overview>
    <Title>Build and Backup Management System</Title>
    <Description>
      Complete reference for managing production and development builds with comprehensive backup capabilities.
      The Nexus system supports dual-build architecture where production and development builds coexist safely.
      This allows testing new features without disrupting the live production system.
    </Description>
  </Overview>

  <BuildArchitecture>
    <BackendStructure>
      <Directory>/backend/web/</Directory>
      <Layout>
        <Production>dist-production/ - Stable production build</Production>
        <Development>dist-dev/ - Development build with latest changes</Development>
        <Symlink>dist -> [symlink] - Points to active build (PM2 runs this)</Symlink>
      </Layout>
    </BackendStructure>

    <FrontendStructure>
      <Directory>/frontend/web/</Directory>
      <Layout>
        <Production>dist-production/ - Stable production build</Production>
        <Development>dist-dev/ - Development build with latest changes</Development>
        <Symlink>dist -> [symlink] - Points to active build (Vite serves this)</Symlink>
      </Layout>
    </FrontendStructure>

    <BackupStructure>
      <Directory>/infrastructure/backups/</Directory>
      <Layout>
        <Backend>backend-builds/
          - dist-production-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz
          - dist-dev-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz
        </Backend>
        <Frontend>frontend-builds/
          - dist-production-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz
          - dist-dev-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz
        </Frontend>
      </Layout>
    </BackupStructure>
  </BuildArchitecture>

  <QuickCommandReference>
    <ServerManagement>
      <Command name="start-production.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/start-production.sh</Path>
        <Description>Start servers with production builds</Description>
      </Command>

      <Command name="start-dev.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/start-dev.sh</Path>
        <Description>Start servers with dev builds</Description>
      </Command>

      <Command name="stop-servers.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/stop-servers.sh</Path>
        <Description>Stop all servers (PM2 + Vite)</Description>
      </Command>

      <Command name="status-servers.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/status-servers.sh</Path>
        <Description>Check server status and active builds</Description>
      </Command>

      <LogViewing>
        <Backend>pm2 logs signhouse-backend</Backend>
        <Frontend>tail -f /tmp/signhouse-frontend.log</Frontend>
      </LogViewing>
    </ServerManagement>

    <UnifiedBuildCommands>
      <Note>Use these to manage both backend and frontend together (recommended)</Note>

      <Command name="build-status.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/build-status.sh</Path>
        <Description>Check current build status</Description>
      </Command>

      <Command name="rebuild-dev.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/rebuild-dev.sh</Path>
        <Description>Rebuild both backend + frontend dev builds</Description>
      </Command>

      <Command name="rebuild-production.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/rebuild-production.sh</Path>
        <Description>Rebuild both backend + frontend production builds</Description>
      </Command>

      <Command name="switch-to-dev.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/switch-to-dev.sh</Path>
        <Description>Switch to dev builds (both backend + frontend)</Description>
      </Command>

      <Command name="switch-to-production.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/switch-to-production.sh</Path>
        <Description>Switch to production builds (both backend + frontend)</Description>
      </Command>
    </UnifiedBuildCommands>

    <IndividualBuildCommands>
      <Note>Use these for granular control when managing backend/frontend separately</Note>

      <BackendCommands>
        <Command name="backend-rebuild-dev.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/backend-rebuild-dev.sh</Path>
          <Description>Rebuild only backend development build</Description>
        </Command>

        <Command name="backend-rebuild-production.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/backend-rebuild-production.sh</Path>
          <Description>Rebuild only backend production build</Description>
        </Command>

        <Command name="backend-switch-to-dev.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/backend-switch-to-dev.sh</Path>
          <Description>Switch only backend to dev build</Description>
        </Command>

        <Command name="backend-switch-to-production.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/backend-switch-to-production.sh</Path>
          <Description>Switch only backend to production build</Description>
        </Command>
      </BackendCommands>

      <FrontendCommands>
        <Command name="frontend-rebuild-dev.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/frontend-rebuild-dev.sh</Path>
          <Description>Rebuild only frontend development build</Description>
        </Command>

        <Command name="frontend-rebuild-production.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/frontend-rebuild-production.sh</Path>
          <Description>Rebuild only frontend production build</Description>
        </Command>

        <Command name="frontend-switch-to-dev.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/frontend-switch-to-dev.sh</Path>
          <Description>Switch only frontend to dev build</Description>
        </Command>

        <Command name="frontend-switch-to-production.sh">
          <Path>/home/jon/Nexus/infrastructure/scripts/frontend-switch-to-production.sh</Path>
          <Description>Switch only frontend to production build</Description>
        </Command>
      </FrontendCommands>
    </IndividualBuildCommands>

    <BackupCommands>
      <Command name="backup-builds.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/backup-builds.sh</Path>
        <Description>Create backups of all current builds (production + dev, backend + frontend)</Description>
      </Command>

      <Command name="list-backups.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/list-backups.sh</Path>
        <Description>List all available backups with sizes and dates</Description>
      </Command>

      <Command name="restore-backup.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/restore-backup.sh &lt;backup-filename&gt;</Path>
        <Description>Restore a specific backup (creates safety backup of current build first)</Description>
        <Examples>
          <Example>restore-backup.sh dist-production-20251118-123340-commit-31dbd7c.tar.gz</Example>
          <Example>restore-backup.sh dist-dev-20251118-123340-commit-31dbd7c.tar.gz</Example>
        </Examples>
      </Command>

      <Command name="cleanup-backups.sh">
        <Path>/home/jon/Nexus/infrastructure/scripts/cleanup-backups.sh [count]</Path>
        <Description>Clean up old backups (keeps last 10 by default)</Description>
        <Examples>
          <Example>cleanup-backups.sh    # Keep last 10</Example>
          <Example>cleanup-backups.sh 20 # Keep last 20</Example>
        </Examples>
      </Command>
    </BackupCommands>
  </QuickCommandReference>

  <DetailedCommandDocumentation>
    <ServerManagementCommands>
      <Command name="start-production.sh">
        <Purpose>Starts both backend (PM2) and frontend (Vite) servers using production builds</Purpose>
        <WhatItDoes>
          <Step>Checks if production builds exist (dist-production/)</Step>
          <Step>Updates symlinks to point to production builds</Step>
          <Step>Starts PM2 backend server</Step>
          <Step>Starts Vite frontend dev server</Step>
          <Step>Displays server status</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Starting the system for production use</UseCase>
          <UseCase>After switching builds to production</UseCase>
          <UseCase>After server reboot</UseCase>
        </WhenToUse>
      </Command>

      <Command name="start-dev.sh">
        <Purpose>Starts both servers using development builds for testing new features</Purpose>
        <WhatItDoes>
          <Step>Checks if dev builds exist (dist-dev/)</Step>
          <Step>Updates symlinks to point to dev builds</Step>
          <Step>Starts PM2 backend server</Step>
          <Step>Starts Vite frontend dev server</Step>
          <Step>Displays server status</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Testing new features before production</UseCase>
          <UseCase>Development work</UseCase>
          <UseCase>Debugging issues</UseCase>
        </WhenToUse>
      </Command>

      <Command name="stop-servers.sh">
        <Purpose>Gracefully stops all running servers</Purpose>
        <WhatItDoes>
          <Step>Stops PM2 backend processes</Step>
          <Step>Kills Vite frontend processes</Step>
          <Step>Cleans up any orphaned processes</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Before system maintenance</UseCase>
          <UseCase>Before switching builds</UseCase>
          <UseCase>Before server shutdown</UseCase>
        </WhenToUse>
      </Command>

      <Command name="status-servers.sh">
        <Purpose>Shows comprehensive status of all servers and builds</Purpose>
        <OutputIncludes>
          <Item>Backend PM2 status and active build</Item>
          <Item>Frontend process status and active build</Item>
          <Item>Which build each component is running</Item>
        </OutputIncludes>
        <WhenToUse>
          <UseCase>Verifying which builds are active</UseCase>
          <UseCase>Troubleshooting server issues</UseCase>
          <UseCase>Confirming successful build switches</UseCase>
        </WhenToUse>
      </Command>
    </ServerManagementCommands>

    <UnifiedBuildCommands>
      <Note>These commands manage both backend and frontend simultaneously (recommended for most use cases)</Note>

      <Command name="build-status.sh">
        <Purpose>Shows current build configuration for both backend and frontend</Purpose>
        <OutputExample>
          <![CDATA[
Current Build Status:
  Backend:  dist-production
  Frontend: dist-production
          ]]>
        </OutputExample>
        <WhenToUse>
          <UseCase>Quick check of active builds</UseCase>
          <UseCase>Before making changes</UseCase>
          <UseCase>Verifying build switches</UseCase>
        </WhenToUse>
      </Command>

      <Command name="rebuild-dev.sh">
        <Purpose>Rebuilds development builds for both backend and frontend</Purpose>
        <WhatItDoes>
          <Step>Builds backend TypeScript to dist/ directory</Step>
          <Step>Moves build to dist-dev/</Step>
          <Step>Builds frontend React/Vite to dist/ directory</Step>
          <Step>Moves build to dist-dev/</Step>
          <Step>Recreates symlinks if needed</Step>
          <Step>Displays build status</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>After making code changes you want to test</UseCase>
          <UseCase>Creating fresh dev builds with latest code</UseCase>
          <UseCase>Updating dev environment</UseCase>
        </WhenToUse>
        <Note>Does not restart servers - use stop-servers.sh + start-dev.sh to apply changes</Note>
      </Command>

      <Command name="rebuild-production.sh">
        <Purpose>Rebuilds production builds for both backend and frontend</Purpose>
        <WhatItDoes>
          <Step>Creates backup of current production builds</Step>
          <Step>Builds backend with production optimizations</Step>
          <Step>Moves to dist-production/</Step>
          <Step>Builds frontend with production optimizations</Step>
          <Step>Moves to dist-production/</Step>
          <Step>Recreates symlinks if needed</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Promoting tested features to production</UseCase>
          <UseCase>Creating stable production builds</UseCase>
          <UseCase>After merging to main branch</UseCase>
        </WhenToUse>
        <Warning>Always test in dev first! Production builds should contain only verified code</Warning>
      </Command>

      <Command name="switch-to-dev.sh">
        <Purpose>Switches both backend and frontend to development builds</Purpose>
        <WhatItDoes>
          <Step>Verifies dev builds exist</Step>
          <Step>Updates backend symlink: dist → dist-dev</Step>
          <Step>Updates frontend symlink: dist → dist-dev</Step>
          <Step>Restarts PM2 backend</Step>
          <Step>Prompts to restart frontend manually</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Testing new features</UseCase>
          <UseCase>Debugging issues in dev environment</UseCase>
          <UseCase>Switching from production to development</UseCase>
        </WhenToUse>
      </Command>

      <Command name="switch-to-production.sh">
        <Purpose>Switches both backend and frontend to production builds</Purpose>
        <WhatItDoes>
          <Step>Verifies production builds exist</Step>
          <Step>Updates backend symlink: dist → dist-production</Step>
          <Step>Updates frontend symlink: dist → dist-production</Step>
          <Step>Restarts PM2 backend</Step>
          <Step>Prompts to restart frontend manually</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Deploying tested features to production</UseCase>
          <UseCase>Reverting from dev to stable production</UseCase>
          <UseCase>After verifying dev build works correctly</UseCase>
        </WhenToUse>
      </Command>
    </UnifiedBuildCommands>

    <IndividualBuildCommands>
      <Note>Use these when you need to manage backend or frontend separately</Note>

      <BackendCommands>
        <Command name="backend-rebuild-dev.sh">
          <Purpose>Rebuilds only backend development build</Purpose>
          <WhenToUse>When frontend doesn't need updating</WhenToUse>
        </Command>

        <Command name="backend-rebuild-production.sh">
          <Purpose>Rebuilds only backend production build</Purpose>
          <Safety>Creates backup of current backend production build first</Safety>
        </Command>

        <Command name="backend-switch-to-dev.sh">
          <Purpose>Switches only backend to dev build</Purpose>
          <Behavior>Restarts PM2 automatically, frontend remains on current build</Behavior>
        </Command>

        <Command name="backend-switch-to-production.sh">
          <Purpose>Switches only backend to production build</Purpose>
          <Behavior>Restarts PM2 automatically, frontend remains on current build</Behavior>
        </Command>
      </BackendCommands>

      <FrontendCommands>
        <Command name="frontend-rebuild-dev.sh">
          <Purpose>Rebuilds only frontend development build</Purpose>
          <WhenToUse>When backend doesn't need updating</WhenToUse>
        </Command>

        <Command name="frontend-rebuild-production.sh">
          <Purpose>Rebuilds only frontend production build</Purpose>
          <Safety>Creates backup of current frontend production build first</Safety>
        </Command>

        <Command name="frontend-switch-to-dev.sh">
          <Purpose>Switches only frontend to dev build</Purpose>
          <Behavior>Prompts to restart Vite manually, backend remains on current build</Behavior>
        </Command>

        <Command name="frontend-switch-to-production.sh">
          <Purpose>Switches only frontend to production build</Purpose>
          <Behavior>Prompts to restart Vite manually, backend remains on current build</Behavior>
        </Command>
      </FrontendCommands>
    </IndividualBuildCommands>

    <BackupCommands>
      <Command name="backup-builds.sh">
        <Purpose>Creates timestamped backups of all current builds with commit hash tracking</Purpose>
        <WhatItBacksUp>
          <Backend>dist-production/ and dist-dev/</Backend>
          <Frontend>dist-production/ and dist-dev/</Frontend>
        </WhatItBacksUp>
        <BackupFormat>
          <Pattern>dist-{production|dev}-YYYYMMDD-HHMMSS-commit-{hash}.tar.gz</Pattern>
        </BackupFormat>
        <Locations>
          <Backend>/home/jon/Nexus/infrastructure/backups/backend-builds/</Backend>
          <Frontend>/home/jon/Nexus/infrastructure/backups/frontend-builds/</Frontend>
        </Locations>
        <WhenToUse>
          <UseCase>Before major refactoring</UseCase>
          <UseCase>Before risky changes</UseCase>
          <UseCase>Weekly/monthly archiving</UseCase>
          <UseCase>Before promoting dev to production</UseCase>
        </WhenToUse>
      </Command>

      <Command name="list-backups.sh">
        <Purpose>Displays all available backups organized by type with sizes</Purpose>
        <OutputIncludes>
          <Item>Backend builds (production + dev)</Item>
          <Item>Frontend builds (production + dev)</Item>
          <Item>Individual file sizes</Item>
          <Item>Total size per category</Item>
          <Item>Sorted by date (newest first)</Item>
        </OutputIncludes>
        <WhenToUse>
          <UseCase>Before restoring to see available backups</UseCase>
          <UseCase>After cleanup to verify retention</UseCase>
          <UseCase>Checking disk space usage</UseCase>
          <UseCase>Finding specific backup by date/commit</UseCase>
        </WhenToUse>
      </Command>

      <Command name="restore-backup.sh">
        <Purpose>Restores a specific backup with safety features</Purpose>
        <SafetyFeatures>
          <Feature>Auto-detects backend vs frontend from filename</Feature>
          <Feature>Creates backup of current build before restoring</Feature>
          <Feature>Prompts for confirmation before proceeding</Feature>
          <Feature>Updates symlinks automatically after restore</Feature>
          <Feature>Preserves commit hash information</Feature>
        </SafetyFeatures>
        <WhatItDoes>
          <Step>Validates backup file exists</Step>
          <Step>Detects backend or frontend from location</Step>
          <Step>Creates safety backup of current build</Step>
          <Step>Extracts backup to appropriate location</Step>
          <Step>Updates symlink if needed</Step>
          <Step>Displays completion status</Step>
        </WhatItDoes>
        <WhenToUse>
          <UseCase>Reverting after failed changes</UseCase>
          <UseCase>Rolling back to known-good build</UseCase>
          <UseCase>Recovering from build corruption</UseCase>
          <UseCase>Testing previous versions</UseCase>
        </WhenToUse>
        <Warning>Always stop servers before restoring, then restart after restore completes</Warning>
      </Command>

      <Command name="cleanup-backups.sh">
        <Purpose>Manages disk space by removing old backups while retaining recent ones</Purpose>
        <DefaultBehavior>
          <Retention>Keeps last 10 backups of each type</Retention>
          <Deletion>Deletes older backups</Deletion>
          <Separation>Operates separately on backend/frontend</Separation>
          <Confirmation>Prompts for confirmation</Confirmation>
        </DefaultBehavior>
        <CustomRetention>
          <Example>cleanup-backups.sh 20  # Keep last 20 backups</Example>
          <Example>cleanup-backups.sh 5   # Keep last 5 backups</Example>
        </CustomRetention>
        <WhatItCleans>
          <Item>Backend production builds (keeps N most recent)</Item>
          <Item>Backend dev builds (keeps N most recent)</Item>
          <Item>Frontend production builds (keeps N most recent)</Item>
          <Item>Frontend dev builds (keeps N most recent)</Item>
        </WhatItCleans>
        <WhenToUse>
          <UseCase>Weekly/monthly maintenance</UseCase>
          <UseCase>When disk space is low</UseCase>
          <UseCase>After creating many test backups</UseCase>
          <UseCase>As part of routine housekeeping</UseCase>
        </WhenToUse>
      </Command>
    </BackupCommands>
  </DetailedCommandDocumentation>

  <CommonWorkflows>
    <Workflow name="Development Mode - Making Code Changes">
      <Description>
        When actively developing, frontend supports hot-reload while backend requires rebuilds.
        This workflow optimizes for quick iteration during development.
      </Description>

      <FrontendDevelopment>
        <Note>Frontend uses Vite hot-reload - changes appear automatically</Note>
        <Setup>
          <Step>Ensure server is running with start-dev.sh</Step>
          <Step>Make changes to frontend code</Step>
          <Step>Changes appear in browser automatically (no rebuild needed)</Step>
        </Setup>
        <Command>Do NOT rebuild - rely on hot-reload</Command>
      </FrontendDevelopment>

      <BackendDevelopment>
        <Note>Backend TypeScript requires recompilation</Note>
        <QuickRebuild>
          <Command>/home/jon/Nexus/infrastructure/scripts/backend-rebuild-dev.sh &amp;&amp; /home/jon/Nexus/infrastructure/scripts/backend-switch-to-dev.sh</Command>
          <Description>Rebuild and switch backend only (frontend stays running)</Description>
        </QuickRebuild>
        <Steps>
          <Step order="1">Make changes to backend code</Step>
          <Step order="2">Run: backend-rebuild-dev.sh &amp;&amp; backend-switch-to-dev.sh</Step>
          <Step order="3">Backend automatically restarts via PM2</Step>
          <Step order="4">Test changes immediately</Step>
        </Steps>
      </BackendDevelopment>
    </Workflow>

    <Workflow name="Testing New Features (Dev to Production)">
      <Step order="1">
        <Command>backup-builds.sh</Command>
        <Purpose>Create backup before starting</Purpose>
      </Step>
      <Step order="2">
        <Action>Make code changes in your editor</Action>
      </Step>
      <Step order="3">
        <Command>rebuild-dev.sh</Command>
        <Purpose>Rebuild dev builds with changes</Purpose>
      </Step>
      <Step order="4">
        <Command>switch-to-dev.sh</Command>
        <Purpose>Switch to dev builds for testing</Purpose>
      </Step>
      <Step order="5">
        <Commands>stop-servers.sh &amp;&amp; start-dev.sh</Commands>
        <Purpose>Restart servers to apply changes</Purpose>
      </Step>
      <Step order="6">
        <Action>Test thoroughly in browser</Action>
      </Step>
      <Step order="7">
        <Command>rebuild-production.sh</Command>
        <Purpose>If tests pass, promote to production</Purpose>
      </Step>
      <Step order="8">
        <Command>switch-to-production.sh</Command>
        <Purpose>Switch to production builds</Purpose>
      </Step>
      <Step order="9">
        <Commands>stop-servers.sh &amp;&amp; start-production.sh</Commands>
        <Purpose>Restart with production builds</Purpose>
      </Step>
    </Workflow>

    <Workflow name="Emergency Rollback">
      <Step order="1">
        <Command>list-backups.sh</Command>
        <Purpose>List available backups</Purpose>
      </Step>
      <Step order="2">
        <Command>stop-servers.sh</Command>
        <Purpose>Stop servers</Purpose>
      </Step>
      <Step order="3">
        <Command>restore-backup.sh &lt;filename&gt;</Command>
        <Purpose>Restore known-good backup</Purpose>
      </Step>
      <Step order="4">
        <Command>start-production.sh</Command>
        <Purpose>Start servers with restored build</Purpose>
      </Step>
      <Step order="5">
        <Action>Verify system works in browser</Action>
      </Step>
    </Workflow>

    <Workflow name="Switching Between Builds (No Rebuild)">
      <SwitchToDev>
        <Step order="1">
          <Command>switch-to-dev.sh</Command>
        </Step>
        <Step order="2">
          <Commands>stop-servers.sh &amp;&amp; start-dev.sh</Commands>
        </Step>
      </SwitchToDev>
      <SwitchToProduction>
        <Step order="1">
          <Command>switch-to-production.sh</Command>
        </Step>
        <Step order="2">
          <Commands>stop-servers.sh &amp;&amp; start-production.sh</Commands>
        </Step>
      </SwitchToProduction>
      <CheckStatus>
        <Command>build-status.sh</Command>
        <Purpose>Check which build is active</Purpose>
      </CheckStatus>
    </Workflow>

    <Workflow name="Weekly Maintenance">
      <Step order="1">
        <Commands>status-servers.sh &amp;&amp; build-status.sh</Commands>
        <Purpose>Check current status</Purpose>
      </Step>
      <Step order="2">
        <Command>backup-builds.sh</Command>
        <Purpose>Create archive of current state</Purpose>
      </Step>
      <Step order="3">
        <Command>cleanup-backups.sh</Command>
        <Purpose>Remove old backups (keep last 10)</Purpose>
      </Step>
      <Step order="4">
        <Command>list-backups.sh</Command>
        <Purpose>Verify cleanup</Purpose>
      </Step>
    </Workflow>

    <Workflow name="Updating Only Backend">
      <Step order="1">
        <Command>backup-builds.sh</Command>
        <Purpose>Create backup</Purpose>
      </Step>
      <Step order="2">
        <Action>Make backend code changes</Action>
      </Step>
      <Step order="3">
        <Command>backend-rebuild-dev.sh</Command>
        <Purpose>Rebuild backend dev</Purpose>
      </Step>
      <Step order="4">
        <Command>backend-switch-to-dev.sh</Command>
        <Purpose>Switch backend to dev (frontend stays on production)</Purpose>
      </Step>
      <Step order="5">
        <Action>Test backend changes (API endpoints)</Action>
      </Step>
      <Step order="6">
        <Command>backend-rebuild-production.sh</Command>
        <Purpose>If good, promote to production</Purpose>
      </Step>
      <Step order="7">
        <Command>backend-switch-to-production.sh</Command>
        <Purpose>Switch to production</Purpose>
      </Step>
    </Workflow>

    <Workflow name="Updating Only Frontend">
      <Step order="1">
        <Command>backup-builds.sh</Command>
        <Purpose>Create backup</Purpose>
      </Step>
      <Step order="2">
        <Action>Make frontend code changes</Action>
      </Step>
      <Step order="3">
        <Command>frontend-rebuild-dev.sh</Command>
        <Purpose>Rebuild frontend dev</Purpose>
      </Step>
      <Step order="4">
        <Command>frontend-switch-to-dev.sh</Command>
        <Purpose>Switch frontend to dev (backend stays on production)</Purpose>
      </Step>
      <Step order="5">
        <Commands>stop-servers.sh &amp;&amp; start-dev.sh</Commands>
        <Purpose>Restart frontend</Purpose>
      </Step>
      <Step order="6">
        <Action>Test frontend changes in UI</Action>
      </Step>
      <Step order="7">
        <Command>frontend-rebuild-production.sh</Command>
        <Purpose>If good, promote to production</Purpose>
      </Step>
      <Step order="8">
        <Command>frontend-switch-to-production.sh</Command>
        <Purpose>Switch to production</Purpose>
      </Step>
    </Workflow>
  </CommonWorkflows>

  <BestPractices>
    <BackupStrategy>
      <Practice>Always backup before major changes</Practice>
      <Practice>Backup before switching to unproven dev builds</Practice>
      <Practice>Keep at least 10 historical backups</Practice>
      <Practice>Run weekly maintenance with cleanup</Practice>
      <Practice>Document commit hash in backups for git correlation</Practice>
    </BackupStrategy>

    <BuildManagement>
      <Practice>Test in dev before promoting to production</Practice>
      <Practice>Use unified commands (rebuild-dev.sh) when possible</Practice>
      <Practice>Use individual commands only when needed</Practice>
      <Practice>Always check build-status.sh after switching</Practice>
      <Practice>Verify servers restart correctly after switches</Practice>
    </BuildManagement>

    <DevelopmentWorkflow>
      <Practice>Make changes → rebuild-dev → test → rebuild-production</Practice>
      <Practice>Never skip dev testing phase</Practice>
      <Practice>Keep production build stable and tested</Practice>
      <Practice>Use git commits aligned with production builds</Practice>
    </DevelopmentWorkflow>

    <Safety>
      <Practice>Stop servers before manual restores</Practice>
      <Practice>Create backups before risky operations</Practice>
      <Practice>Test rollback procedure periodically</Practice>
      <Practice>Monitor disk space for backup storage</Practice>
      <Practice>Document which commit each production build represents</Practice>
    </Safety>
  </BestPractices>

  <Troubleshooting>
    <Issue name="Build doesn't exist">
      <Error>dist-dev/ or dist-production/ not found</Error>
      <Solution>
        <Command>rebuild-dev.sh</Command>
        <Alternative>rebuild-production.sh</Alternative>
        <Description>Rebuild the missing build</Description>
      </Solution>
    </Issue>

    <Issue name="Symlink broken">
      <Check>
        <Command>readlink /home/jon/Nexus/backend/web/dist</Command>
        <Description>Check symlink status</Description>
      </Check>
      <ManualFix>
        <![CDATA[
cd /home/jon/Nexus/backend/web
rm dist
ln -s dist-production dist
        ]]>
      </ManualFix>
    </Issue>

    <Issue name="Server won't start">
      <DiagnosticSteps>
        <Step order="1">
          <Command>build-status.sh</Command>
          <Purpose>Check build status</Purpose>
        </Step>
        <Step order="2">
          <Command>status-servers.sh</Command>
          <Purpose>Check server status</Purpose>
        </Step>
        <Step order="3">
          <Commands>pm2 logs signhouse-backend &amp;&amp; tail -f /tmp/signhouse-frontend.log</Commands>
          <Purpose>Check logs</Purpose>
        </Step>
        <Step order="4">
          <Commands>ls -la /home/jon/Nexus/backend/web/dist*/ &amp;&amp; ls -la /home/jon/Nexus/frontend/web/dist*/</Commands>
          <Purpose>Verify builds exist</Purpose>
        </Step>
      </DiagnosticSteps>
    </Issue>

    <Issue name="Backup restore failed">
      <DiagnosticSteps>
        <Step order="1">
          <Command>list-backups.sh</Command>
          <Purpose>Verify backup file exists</Purpose>
        </Step>
        <Step order="2">
          <Command>tar -tzf &lt;backup-file&gt; &gt; /dev/null</Command>
          <Purpose>Check backup file integrity</Purpose>
        </Step>
        <Step order="3">
          <ManualRestore>
            <![CDATA[
cd /home/jon/Nexus/backend/web  # or frontend/web
tar -xzf /home/jon/Nexus/infrastructure/backups/backend-builds/<backup-file>
            ]]>
          </ManualRestore>
        </Step>
      </DiagnosticSteps>
    </Issue>

    <Issue name="Disk space low">
      <Solutions>
        <Solution>
          <Command>cleanup-backups.sh 5</Command>
          <Description>Clean up old backups aggressively (keep only last 5)</Description>
        </Solution>
        <Solution>
          <Command>list-backups.sh</Command>
          <Description>Check backup sizes</Description>
        </Solution>
        <Solution>
          <ManualCleanup>rm /home/jon/Nexus/infrastructure/backups/backend-builds/dist-*-OLD.tar.gz</ManualCleanup>
          <Description>Manual cleanup if needed</Description>
        </Solution>
      </Solutions>
    </Issue>
  </Troubleshooting>

  <TechnicalDetails>
    <SymlinkMechanism>
      <Description>The system uses symlinks to switch between builds instantly without rebuilding</Description>
      <Example>
        <![CDATA[
# Current state
dist -> dist-production/   # PM2 runs code from dist-production/

# Switch to dev
rm dist
ln -s dist-dev dist       # PM2 now runs code from dist-dev/

# Switch back to production
rm dist
ln -s dist-production dist
        ]]>
      </Example>
    </SymlinkMechanism>

    <BuildProcess>
      <Backend>
        <Technology>TypeScript</Technology>
        <Steps>
          <Step>npm run build compiles TypeScript → JavaScript</Step>
          <Step>Output goes to dist/ directory</Step>
          <Step>Move to dist-production/ or dist-dev/</Step>
          <Step>Recreate dist symlink to appropriate target</Step>
        </Steps>
      </Backend>

      <Frontend>
        <Technology>React + Vite</Technology>
        <Steps>
          <Step>npm run build bundles React app</Step>
          <Step>Output goes to dist/ directory</Step>
          <Step>Move to dist-production/ or dist-dev/</Step>
          <Step>Recreate dist symlink to appropriate target</Step>
        </Steps>
      </Frontend>
    </BuildProcess>

    <PM2ProcessManagement>
      <Description>PM2 serves the backend from whatever dist/ points to</Description>
      <StartCommand>pm2 start dist/index.js --name signhouse-backend</StartCommand>
      <RestartBehavior>Restarting PM2 after symlink change loads new code</RestartBehavior>
      <RestartCommand>pm2 restart signhouse-backend</RestartCommand>
    </PM2ProcessManagement>

    <BackupCompression>
      <Method>tar + gzip for efficient storage</Method>
      <CreateBackup>tar -czf backup.tar.gz dist-production/</CreateBackup>
      <RestoreBackup>tar -xzf backup.tar.gz</RestoreBackup>
      <TypicalSizes>
        <Backend>~500-600KB compressed</Backend>
        <Frontend>~400-500KB compressed</Frontend>
      </TypicalSizes>
    </BackupCompression>
  </TechnicalDetails>

  <ScriptLocations>
    <BaseDirectory>/home/jon/Nexus/infrastructure/scripts/</BaseDirectory>

    <ServerManagement>
      <Script>start-production.sh</Script>
      <Script>start-dev.sh</Script>
      <Script>stop-servers.sh</Script>
      <Script>status-servers.sh</Script>
    </ServerManagement>

    <BuildManagementUnified>
      <Script>build-status.sh</Script>
      <Script>rebuild-dev.sh</Script>
      <Script>rebuild-production.sh</Script>
      <Script>switch-to-dev.sh</Script>
      <Script>switch-to-production.sh</Script>
    </BuildManagementUnified>

    <BuildManagementIndividual>
      <Backend>
        <Script>backend-rebuild-dev.sh</Script>
        <Script>backend-rebuild-production.sh</Script>
        <Script>backend-switch-to-dev.sh</Script>
        <Script>backend-switch-to-production.sh</Script>
      </Backend>
      <Frontend>
        <Script>frontend-rebuild-dev.sh</Script>
        <Script>frontend-rebuild-production.sh</Script>
        <Script>frontend-switch-to-dev.sh</Script>
        <Script>frontend-switch-to-production.sh</Script>
      </Frontend>
    </BuildManagementIndividual>

    <BackupManagement>
      <Script>backup-builds.sh</Script>
      <Script>list-backups.sh</Script>
      <Script>restore-backup.sh</Script>
      <Script>cleanup-backups.sh</Script>
    </BackupManagement>

    <Deprecated>
      <Script>start-servers.sh</Script>
      <Reason>Not build-aware, use start-production.sh or start-dev.sh instead</Reason>
    </Deprecated>
  </ScriptLocations>

  <RelatedDocumentation>
    <Document>CLAUDE.md - Main project instructions and architecture</Document>
    <Document>testingChecklist.md - Testing procedures before deployment</Document>
    <Document>Nexus_JobEstimation.md - Job estimation feature documentation</Document>
    <Document>DATABASE_QUERY_STANDARDIZATION_PLAN.md - Database query patterns</Document>
  </RelatedDocumentation>

  <MaintenanceNotes>
    <Note>Backups are stored in /home/jon/Nexus/infrastructure/backups/</Note>
    <Note>NEVER manually modify files in the backups directory</Note>
    <Note>Backup retention default: 10 most recent per type</Note>
    <Note>Recommended cleanup frequency: Weekly or monthly</Note>
    <Note>Monitor disk space in /home/jon/Nexus/infrastructure/backups/</Note>
  </MaintenanceNotes>
</BuildManagementGuide>
