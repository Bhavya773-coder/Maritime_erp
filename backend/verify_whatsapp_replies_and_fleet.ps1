$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Arvind Port & Infra Limited - WhatsApp Reply Commands & Fleet Query Test" -ForegroundColor Cyan
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
        email = "owner@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:session
    $script:ownerId = $res.data.user.id
    return $res
}

# 2. Get Hardik Kateshiya ID
Assert-Step "2. Get Hardik Kateshiya ID" {
    $loginBody = @{
        email = "hardik.kateshiya@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $script:hardikId = $res.data.user.id
    Write-Host "  Hardik Kateshiya User ID: $script:hardikId" -ForegroundColor Gray
}

# 3. Get Gunvant ID
Assert-Step "3. Get Gunvant ID" {
    $loginBody = @{
        email = "gunvant@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $script:gunvantId = $res.data.user.id
    Write-Host "  Gunvant User ID: $script:gunvantId" -ForegroundColor Gray
}

# 3b. Get Jaman Fadadu ID (Accounts User)
Assert-Step "3b. Get Jaman Fadadu (Accounts) ID" {
    $loginBody = @{
        email = "jaman@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $script:jamanId = $res.data.user.id
    Write-Host "  Jaman Fadadu User ID: $script:jamanId" -ForegroundColor Gray
}

# Cleanup active tasks and bot commands to ensure a clean state
Assert-Step "3c. Cleanup active tasks for Hardik Kateshiya and Gunvant" {
    $cleanupScript = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const hardik = await prisma.user.findFirst({ where: { email: 'hardik.kateshiya@apil.local' } });
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
  const gunvant = await prisma.user.findFirst({ where: { email: 'gunvant@apil.local' } });
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
run().catch(console.error).finally(() => prisma.$disconnect());
'@
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

# 6b. Create UserContact for Jaman Fadadu (Accounts)
Assert-Step "6b. Create UserContact for Jaman Fadadu" {
    $body = @{
        userId = $script:jamanId
        phoneNumber = "915555555555"
        channel = "WHATSAPP"
        isVerified = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    Write-Host "  Registered Jaman Fadadu phone: $($res.data.contact.phoneNumber)" -ForegroundColor Gray
}

# 7. Send valid command from Owner to assign task to Hardik K
$taskRes = Assert-Step "7. Assign task to Hardik K via Bot command" {
    $body = @{
        fromPhone = "919999999999"
        message = "Tell Hardik K to check progress of KB-26 repairing"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "7b. Verify task assignment" {
    if ($taskRes.status -ne "success") { throw "Expected status 'success', got: $($taskRes.status)" }
    $script:taskId = $taskRes.data.task.id
    Write-Host "  Created Task ID: $script:taskId" -ForegroundColor Gray
}

# 8. Send UPDATE: check progress from Hardik's phone
$updateRes = Assert-Step "8. Send UPDATE: check progress from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "UPDATE: check progress"
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

# 10. Send DONE from Hardik's phone
$doneRes = Assert-Step "10. Send DONE from Hardik" {
    $body = @{
        fromPhone = "918888888888"
        message = "DONE"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "10b. Verify DONE results" {
    if ($doneRes.status -ne "success") { throw "Expected status 'success', got: $($doneRes.status)" }
    Write-Host "  Done response message: $($doneRes.data.notifications[0].rawText)" -ForegroundColor Gray
    if ($doneRes.data.notifications[0].rawText -notmatch "Task marked completed") {
        throw "Incorrect done response: $($doneRes.data.notifications[0].rawText)"
    }
}

# 11. Send "Where is ARCADIA 1?" from verified phone (Owner)
$vesselRes = Assert-Step "11. Query Where is ARCADIA 1?" {
    $body = @{
        fromPhone = "919999999999"
        message = "Where is ARCADIA 1?"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "11b. Verify vessel status response" {
    if ($vesselRes.status -ne "success") { throw "Expected status 'success', got: $($vesselRes.status)" }
    Write-Host "  Vessel Info text:`n$($vesselRes.message)" -ForegroundColor Gray
    if ($vesselRes.message -notmatch "ARCADIA 1") { throw "Vessel info response missing vessel name" }
    if ($vesselRes.message -notmatch "PRESNT LOCATION:") { throw "Vessel info response missing location details" }
}

# 12. Send "Show all barges" from verified phone
$bargesRes = Assert-Step "12. Query Show all barges" {
    $body = @{
        fromPhone = "919999999999"
        message = "Show all barges"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "12b. Verify barges list" {
    if ($bargesRes.status -ne "success") { throw "Expected status 'success', got: $($bargesRes.status)" }
    Write-Host "  Barges list:`n$($bargesRes.message)" -ForegroundColor Gray
    if ($bargesRes.message -notmatch "KB 26") { throw "Barges list missing KB 26" }
}

# 13. Send "Show all tugs" from verified phone
$tugsRes = Assert-Step "13. Query Show all tugs" {
    $body = @{
        fromPhone = "919999999999"
        message = "Show all tugs"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "13b. Verify tugs list" {
    if ($tugsRes.status -ne "success") { throw "Expected status 'success', got: $($tugsRes.status)" }
    Write-Host "  Tugs list:`n$($tugsRes.message)" -ForegroundColor Gray
    if ($tugsRes.message -notmatch "ARCADIA 1") { throw "Tugs list missing ARCADIA 1" }
}

# 14. Send "Which vessels are in port?" from verified phone
$inPortRes = Assert-Step "14. Query Which vessels are in port?" {
    $body = @{
        fromPhone = "919999999999"
        message = "Which vessels are in port?"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "14b. Verify in port list" {
    if ($inPortRes.status -ne "success") { throw "Expected status 'success', got: $($inPortRes.status)" }
    Write-Host "  In port list:`n$($inPortRes.message)" -ForegroundColor Gray
    if ($inPortRes.message -notmatch "Vessels in Port:") { throw "List missing header 'Vessels in Port:'" }
}

# 15. Create a reminder task to test process-due reminders
$remTaskRes = Assert-Step "15. Assign another task to Hardik K to create a pending reminder" {
    $body = @{
        fromPhone = "919999999999"
        message = "Tell Hardik K to check vessel fuel level"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

# Force reminder to be due in the database
Assert-Step "15b. Force reminder to be due in database" {
    $forceScript = @'
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
}).finally(() => prisma.$disconnect());
'@
    $forceScript | Out-File -FilePath "force_reminder_due.js" -Encoding utf8
    node force_reminder_due.js
    Remove-Item "force_reminder_due.js"
}

# 16. Trigger process-due reminders
$remindersRes = Assert-Step "16. Trigger process-due reminders" {
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/reminders/process-due" -Method Post -WebSession $script:session
    return $res
}

Assert-Step "16b. Verify reminder counts" {
    if ($remindersRes.status -ne "success") { throw "Expected status 'success', got: $($remindersRes.status)" }
    $stats = $remindersRes.data
    Write-Host "  Stats - Checked: $($stats.checked), Sent: $($stats.sent), Completed: $($stats.completed), Skipped: $($stats.skipped)" -ForegroundColor Gray
    if ($stats.checked -eq 0) { throw "Expected checked reminders to be > 0" }
    if ($stats.sent -eq 0) { throw "Expected sent reminders to be > 0" }
}

# 17. Send message from an unknown phone returns unregistered warning
$unregRes = Assert-Step "17. Send reply from unregistered phone" {
    $body = @{
        fromPhone = "911111111111"
        message = "HELP"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "17b. Verify unregistered phone response" {
    if ($unregRes.status -ne "success") { throw "Expected status 'success', got: $($unregRes.status)" }
    Write-Host "  Unregistered phone response message: $($unregRes.message)" -ForegroundColor Gray
    if ($unregRes.message -notmatch "Commands:") {
        throw "Expected help message, got: $($unregRes.message)"
    }
}

# 18. Jaman (Accounts/normal verified user) can ask fleet info
$jamanQueryRes = Assert-Step "18. Query Where is ARCADIA 1? as Accounts (Jaman)" {
    $body = @{
        fromPhone = "915555555555"
        message = "Where is ARCADIA 1?"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "18b. Verify Jaman response" {
    if ($jamanQueryRes.status -ne "success") { throw "Expected status 'success', got: $($jamanQueryRes.status)" }
    Write-Host "  Jaman Response Info:`n$($jamanQueryRes.message)" -ForegroundColor Gray
    if ($jamanQueryRes.message -notmatch "ARCADIA 1") { throw "Vessel info response missing vessel name" }
}

Write-Host "`nAll WhatsApp Task Replies and Fleet queries verification steps completed successfully!" -ForegroundColor Green
