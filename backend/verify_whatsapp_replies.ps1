$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Sagar Shipping Maritime ERP - WhatsApp Reply Commands & Reminder Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Helper function to print results and assert step status
function Assert-Step($stepName, $scriptBlock) {
    Write-Host "`n[$stepName] Running..." -ForegroundColor Yellow
    try {
        $res = & $scriptBlock
        Write-Host "[$stepName] PASS" -ForegroundColor Green
        return $res
    } catch {
        Write-Host "[$stepName] FAIL" -ForegroundColor Red
        Write-Host "Error Details: $_" -ForegroundColor DarkRed
        Exit 1
    }
}

# 1. Login as Owner
$script:session = $null
$loginRes = Assert-Step "1. Login as Owner" {
    $loginBody = @{
        email = "owner@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:session
    $script:ownerId = $res.data.user.id
    return $res
}

# 2. Get Hardik Kateshiya ID
Assert-Step "2. Get Hardik Kateshiya ID" {
    $loginBody = @{
        email = "hardik.kateshiya@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $script:hardikId = $res.data.user.id
    Write-Host "  Hardik Kateshiya User ID: $script:hardikId" -ForegroundColor Gray
}

# 3. Get Gunvant ID
Assert-Step "3. Get Gunvant ID" {
    $loginBody = @{
        email = "gunvant@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $script:gunvantId = $res.data.user.id
    Write-Host "  Gunvant User ID: $script:gunvantId" -ForegroundColor Gray
}

# Cleanup Hardik Kateshiya and Gunvant's active tasks and bot commands to ensure a clean state
Assert-Step "3b. Cleanup active tasks for Hardik Kateshiya and Gunvant" {
    $cleanupScript = @"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const hardik = await prisma.user.findFirst({ where: { email: 'hardik.kateshiya@sagarshipping.local' } });
  if (hardik) {
    await prisma.task.updateMany({
      where: { assignedToId: hardik.id, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    await prisma.botReminder.updateMany({
      where: { assignedToId: hardik.id, status: 'ACTIVE' },
      data: { status: 'COMPLETED' }
    });
  }
  const gunvant = await prisma.user.findFirst({ where: { email: 'gunvant@sagarshipping.local' } });
  if (gunvant) {
    await prisma.task.updateMany({
      where: { assignedToId: gunvant.id, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    await prisma.botReminder.updateMany({
      where: { assignedToId: gunvant.id, status: 'ACTIVE' },
      data: { status: 'COMPLETED' }
    });
  }
}
run().catch(console.error).finally(() => prisma.\$disconnect());
"@
    $cleanupScript | Out-File -FilePath "cleanup_tasks.js" -Encoding utf8
    node cleanup_tasks.js
    Remove-Item "cleanup_tasks.js"
}

# 4. Create UserContact for Owner
Assert-Step "4. Create UserContact for Owner" {
    $body = @{
        userId = $script:ownerId
        phoneNumber = "919999999999"
        channel = "WHATSAPP"
        isVerified = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    Write-Host "  Registered owner phone: $($res.data.contact.phoneNumber)" -ForegroundColor Gray
}

# 5. Create UserContact for Hardik Kateshiya
Assert-Step "5. Create UserContact for Hardik Kateshiya" {
    $body = @{
        userId = $script:hardikId
        phoneNumber = "918888888888"
        channel = "WHATSAPP"
        isVerified = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    Write-Host "  Registered Hardik Kateshiya phone: $($res.data.contact.phoneNumber)" -ForegroundColor Gray
}

# 6. Create UserContact for Gunvant
Assert-Step "6. Create UserContact for Gunvant" {
    $body = @{
        userId = $script:gunvantId
        phoneNumber = "917777777777"
        channel = "WHATSAPP"
        isVerified = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    Write-Host "  Registered Gunvant phone: $($res.data.contact.phoneNumber)" -ForegroundColor Gray
}

# 7. Send valid command from Owner to assign task to Hardik K
$taskRes = Assert-Step "7. Assign task to Hardik K via Bot command" {
    $body = @{
        fromPhone = "919999999999"
        message = "Tell Hardik K to check the progress of the KB-26 repairing"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "7b. Verify task assignment" {
    if ($taskRes.status -ne "success") { throw "Expected status 'success', got: $($taskRes.status)" }
    $script:taskId = $taskRes.data.task.id
    Write-Host "  Created Task ID: $script:taskId" -ForegroundColor Gray
}

# 8. Send UPDATE: estimate in progress from Hardik's phone
$updateRes = Assert-Step "8. Send UPDATE: estimate in progress from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "UPDATE: estimate in progress"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "8b. Verify UPDATE results" {
    if ($updateRes.status -ne "success") { throw "Expected status 'success', got: $($updateRes.status)" }
    Write-Host "  Update confirmation message: $($updateRes.data.notifications[0].rawText)" -ForegroundColor Gray
    if ($updateRes.data.notifications[0].rawText -notmatch "Update added to task") {
        throw "Incorrect update confirmation message: $($updateRes.data.notifications[0].rawText)"
    }
}

# 9. Send STATUS from Hardik's phone
$statusRes = Assert-Step "9. Send STATUS from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "STATUS"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "9b. Verify STATUS results" {
    if ($statusRes.status -ne "success") { throw "Expected status 'success', got: $($statusRes.status)" }
    Write-Host "  Status text: $($statusRes.message)" -ForegroundColor Gray
    if ($statusRes.message -notmatch "Your active tasks:") {
        throw "Expected status message to contain 'Your active tasks:', got: $($statusRes.message)"
    }
}

# 10. Send HELP from Hardik's phone
$helpRes = Assert-Step "10. Send HELP from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "HELP"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "10b. Verify HELP results" {
    if ($helpRes.status -ne "success") { throw "Expected status 'success', got: $($helpRes.status)" }
    Write-Host "  Help text: $($helpRes.message)" -ForegroundColor Gray
    if ($helpRes.message -notmatch "Reply commands:") {
        throw "Expected help message to contain 'Reply commands:', got: $($helpRes.message)"
    }
}

# 11. Send DONE from Hardik's phone
$doneRes = Assert-Step "11. Send DONE from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "DONE"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "11b. Verify DONE results" {
    if ($doneRes.status -ne "success") { throw "Expected status 'success', got: $($doneRes.status)" }
    Write-Host "  Done response message: $($doneRes.data.notifications[0].rawText)" -ForegroundColor Gray
    if ($doneRes.data.notifications[0].rawText -notmatch "Task marked completed") {
        throw "Incorrect done response: $($doneRes.data.notifications[0].rawText)"
    }
}

# 12. Assign another task to Hardik K
$secondTaskRes = Assert-Step "12. Assign second task to Hardik K" {
    $body = @{
        fromPhone = "919999999999"
        message = "Tell Hardik K to check the vessel fuel level"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "12b. Verify second task" {
    if ($secondTaskRes.status -ne "success") { throw "Expected status 'success', got: $($secondTaskRes.status)" }
    $script:secondTaskId = $secondTaskRes.data.task.id
    Write-Host "  Created Second Task ID: $script:secondTaskId" -ForegroundColor Gray
}

# 13. Send DELEGATE: Gunvant - repair estimate needed from Hardik's phone
$delegateRes = Assert-Step "13. Send DELEGATE: Gunvant - repair estimate needed from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "DELEGATE: Gunvant - repair estimate needed"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "13b. Verify delegation results" {
    if ($delegateRes.status -ne "success") { throw "Expected status 'success', got: $($delegateRes.status)" }
    $notifications = $delegateRes.data.notifications
    Write-Host "  Delegate status notification: $($notifications[0].rawText)" -ForegroundColor Gray
    if ($notifications[0].rawText -notmatch "Task delegated to Gunvant") {
        throw "Incorrect delegation response: $($notifications[0].rawText)"
    }
    
    # Assert Gunvant received notification message
    $gunvantNotif = $notifications | Where-Object { $_.toPhone -eq "917777777777" }
    if ($null -eq $gunvantNotif) { throw "Expected notification for Gunvant phone '917777777777' not found." }
    Write-Host "  Gunvant Notification text: $($gunvantNotif.rawText)" -ForegroundColor Gray
    if ($gunvantNotif.rawText -notmatch "New task delegated to you by Hardik Kateshiya") {
        throw "Incorrect Gunvant notification: $($gunvantNotif.rawText)"
    }
}

# 14. Force reminder to be due in the database
Assert-Step "14. Force reminder to be due in database" {
    $forceScript = @"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.botReminder.updateMany({
  where: { status: 'ACTIVE' },
  data: { nextReminderAt: new Date(Date.now() - 3600000) }
}).then((r) => {
  console.log('Successfully forced ' + r.count + ' active reminders to be due.');
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.\$disconnect());
"@
    $forceScript | Out-File -FilePath "force_reminder_due.js" -Encoding utf8
    node force_reminder_due.js
    Remove-Item "force_reminder_due.js"
}

# 15. Trigger process-due reminders
$remindersRes = Assert-Step "15. Trigger process-due reminders" {
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/reminders/process-due" -Method Post -WebSession $script:session
    return $res
}

Assert-Step "15b. Verify reminder counts" {
    if ($remindersRes.status -ne "success") { throw "Expected status 'success', got: $($remindersRes.status)" }
    $stats = $remindersRes.data
    Write-Host "  Stats - Checked: $($stats.checked), Sent: $($stats.sent), Completed: $($stats.completed), Skipped: $($stats.skipped)" -ForegroundColor Gray
    if ($stats.checked -eq 0) { throw "Expected checked reminders to be > 0" }
    if ($stats.sent -eq 0) { throw "Expected sent reminders to be > 0" }
}

# 16. Send message from an unknown phone returns unregistered warning
$unregRes = Assert-Step "16. Send reply from unregistered phone" {
    $body = @{
        fromPhone = "911111111111"
        message = "DONE"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "16b. Verify unregistered phone response" {
    if ($unregRes.status -ne "unregistered") { throw "Expected status 'unregistered', got: $($unregRes.status)" }
    Write-Host "  Unregistered phone response message: $($unregRes.message)" -ForegroundColor Gray
    if ($unregRes.message -ne "Your number is not registered in Sagar ERP.") {
        throw "Incorrect unregistered message: $($unregRes.message)"
    }
}

Write-Host "`nAll WhatsApp Reply Commands and Reminder verification steps completed successfully!" -ForegroundColor Cyan
