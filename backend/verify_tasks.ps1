$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Sagar Shipping Maritime ERP - Task API Test" -ForegroundColor Cyan
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
        # Stop script execution immediately if critical
        if ($stepName -eq "1. Login" -or $stepName -eq "2. Create Assigned Task") {
            Write-Host "`nCRITICAL STEP FAILED. Stopping verification script." -ForegroundColor Red
            Exit 1
        }
    }
}

# 1. Login
$script:session = $null
$loginRes = Assert-Step "1. Login" {
    $loginBody = @{
        email = "owner@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:session
    return $res
}

# Get User IDs
Assert-Step "Prep. Get Ramesh Mota ID" {
    $rameshBody = @{
        email = "ramesh@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $rameshLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $rameshBody -SessionVariable script:rameshSession
    $script:rameshId = $rameshLogin.data.user.id
    Write-Host "Ramesh Mota's user ID: $script:rameshId" -ForegroundColor Gray
}

Assert-Step "Prep. Get Jaman Fadadu ID" {
    $jamanBody = @{
        email = "jaman@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $jamanLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $jamanBody -SessionVariable script:jamanSession
    $script:jamanId = $jamanLogin.data.user.id
    Write-Host "Jaman Fadadu's user ID: $script:jamanId" -ForegroundColor Gray
}

# 2. Create Assigned Task
$assignedTask = Assert-Step "2. Create Assigned Task" {
    $assignedTaskBody = @{
        title = "Inspect Vessel Sagar Barge 1"
        description = "Perform standard GMB registration safety inspection."
        taskType = "ASSIGNED"
        assignedToId = $script:rameshId
        dueDate = "2026-06-12" # Test date-only format
        priority = "HIGH"
        status = "PENDING"
    } | ConvertTo-Json

    $taskRes = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -ContentType "application/json" -Body $assignedTaskBody -WebSession $script:session
    $script:assignedTaskId = $taskRes.data.task.id
    Write-Host "Assigned Task Created! ID: $script:assignedTaskId" -ForegroundColor Gray
    return $taskRes
}

# 3. Create Personal Task
Assert-Step "3. Create Personal Task" {
    $personalTaskBody = @{
        title = "Review quarterly tax calculations"
        description = "Internal review of ledger reports."
        taskType = "PERSONAL"
        priority = "MEDIUM"
        status = "PENDING"
    } | ConvertTo-Json

    $taskRes = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -ContentType "application/json" -Body $personalTaskBody -WebSession $script:session
    $script:personalTaskId = $taskRes.data.task.id
    Write-Host "Personal Task Created! ID: $script:personalTaskId" -ForegroundColor Gray
}

# 4. List Tasks (by type)
Assert-Step "4. List Tasks (type=assigned)" {
    $res = Invoke-RestMethod -Uri "$baseUrl/tasks?type=assigned" -Method Get -WebSession $script:session
    Write-Host "Found $($res.data.tasks.Count) assigned tasks." -ForegroundColor Gray
}

Assert-Step "4b. Owner View All (/tasks/all)" {
    $res = Invoke-RestMethod -Uri "$baseUrl/tasks/all" -Method Get -WebSession $script:session
    Write-Host "Owner sees total $($res.data.tasks.Count) tasks." -ForegroundColor Gray
}

# 5. Delegate Assigned Task
Assert-Step "5. Delegate Assigned Task" {
    $delegateBody = @{
        assignedToId = $script:jamanId
        note = "Jaman, please double check accounts ledger details during inspection."
    } | ConvertTo-Json

    Invoke-RestMethod -Uri "$baseUrl/tasks/$script:assignedTaskId/delegate" -Method Post -ContentType "application/json" -Body $delegateBody -WebSession $script:session
}

# 6. Get Delegation Chain
Assert-Step "6. Get Delegation Chain" {
    $chainRes = Invoke-RestMethod -Uri "$baseUrl/tasks/$script:assignedTaskId/chain" -Method Get -WebSession $script:session
    foreach ($step in $chainRes.chain.steps) {
        Write-Host "  $($step.from.name) -> $($step.to.name) (Note: $($step.note))" -ForegroundColor Gray
    }
}

# 7. Add Comment
Assert-Step "7. Add Comment" {
    $commentBody = @{
        content = "I have uploaded the preliminary survey checklist."
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$baseUrl/tasks/$script:assignedTaskId/comment" -Method Post -ContentType "application/json" -Body $commentBody -WebSession $script:session
    Write-Host "Comment content: $($res.data.comment.content)" -ForegroundColor Gray
}

# 8. Update Status (lowercase status)
Assert-Step "8. Update Status (lowercase status)" {
    $statusBody = @{
        status = "in_progress" # Test lowercase mapping
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$baseUrl/tasks/$script:assignedTaskId/status" -Method Patch -ContentType "application/json" -Body $statusBody -WebSession $script:session
    Write-Host "New status: $($res.data.task.status)" -ForegroundColor Gray
}

# 9. Try deleting assigned task (Confirm 403)
Assert-Step "9. Try deleting ASSIGNED task" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/tasks/$script:assignedTaskId" -Method Delete -WebSession $script:session
        throw "Should have thrown a 403 error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 403) {
            Write-Host "Correctly blocked delete. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

# 10. Delete Personal Task
Assert-Step "10. Delete Personal Task" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$script:personalTaskId" -Method Delete -WebSession $script:session
}

# 11. Mark Overdue
Assert-Step "11. Mark Overdue" {
    $res = Invoke-RestMethod -Uri "$baseUrl/tasks/mark-overdue" -Method Patch -WebSession $script:session
    Write-Host "Marked count: $($res.data.count)" -ForegroundColor Gray
}

# 12. Test UUID validation param check
Assert-Step "12. Test UUID Validation param check" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/tasks/not-a-valid-uuid" -Method Get -WebSession $script:session
        throw "Should have thrown a 400 error for invalid UUID"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked invalid UUID. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

Write-Host "`nAll verification steps completed." -ForegroundColor Cyan
