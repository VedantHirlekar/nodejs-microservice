import groovy.json.JsonOutput

pipeline {

    agent any

    environment {
        AWS_REGION = 'eu-north-1'
        AWS_ACCOUNT_ID = '206003749282'
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

        APP_INSTANCE_ID = 'i-0609f3bfe8e4522cd'
        APP_PROJECT_DIR = '/home/ssm-user/nodejs-microservice'

        IMAGE_TAG = "v${BUILD_NUMBER}"
    }

    stages {

        // ============================================================
        // CHECKOUT
        // ============================================================

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // ============================================================
        // CHECK TOOLS
        // ============================================================

        stage('Check Tools') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "CHECKING TOOLS"
                    echo "=========================================="

                    whoami
                    docker --version
                    
                    aws --version
                    git --version
                '''
            }
        }

        // ============================================================
        // ECR LOGIN
        // ============================================================

        stage('ECR Login') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "ECR LOGIN"
                    echo "=========================================="

                    aws ecr get-login-password \
                        --region ${AWS_REGION} | \
                    docker login \
                        --username AWS \
                        --password-stdin ${ECR_REGISTRY}
                '''
            }
        }

        // ============================================================
        // BUILD ALL IMAGES
        // ============================================================

        stage('Build Images') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "BUILDING IMAGES"
                    echo "TAG: ${IMAGE_TAG}"
                    echo "=========================================="

                    docker build \
                        -t ${ECR_REGISTRY}/user-service:${IMAGE_TAG} \
                        ./user-service

                    docker build \
                        -t ${ECR_REGISTRY}/product-service:${IMAGE_TAG} \
                        ./product-service

                    docker build \
                        -t ${ECR_REGISTRY}/order-service:${IMAGE_TAG} \
                        ./order-service

                    docker build \
                        -t ${ECR_REGISTRY}/payment-service:${IMAGE_TAG} \
                        ./payment-service

                    docker build \
                        -t ${ECR_REGISTRY}/notification-service:${IMAGE_TAG} \
                        ./notification-service
                '''
            }
        }

        // ============================================================
        // PUSH ALL IMAGES
        // ============================================================

        stage('Push Images') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "PUSHING IMAGES"
                    echo "=========================================="

                    docker push \
                        ${ECR_REGISTRY}/user-service:${IMAGE_TAG}

                    docker push \
                        ${ECR_REGISTRY}/product-service:${IMAGE_TAG}

                    docker push \
                        ${ECR_REGISTRY}/order-service:${IMAGE_TAG}

                    docker push \
                        ${ECR_REGISTRY}/payment-service:${IMAGE_TAG}

                    docker push \
                        ${ECR_REGISTRY}/notification-service:${IMAGE_TAG}
                '''
            }
        }

        // ============================================================
        // DEPLOY USER SERVICE
        // ============================================================

        stage('Deploy user-service') {
            steps {
                script {
                    deployService(
                        'user-service',
                        '/users/health'
                    )
                }
            }
        }

        // ============================================================
        // DEPLOY PRODUCT SERVICE
        // ============================================================

        stage('Deploy product-service') {
            steps {
                script {
                    deployService(
                        'product-service',
                        '/products/health'
                    )
                }
            }
        }

        // ============================================================
        // DEPLOY ORDER SERVICE
        // ============================================================

        stage('Deploy order-service') {
            steps {
                script {
                    deployService(
                        'order-service',
                        '/orders/health'
                    )
                }
            }
        }

        // ============================================================
        // DEPLOY PAYMENT SERVICE
        // ============================================================

        stage('Deploy payment-service') {
            steps {
                script {
                    deployService(
                        'payment-service',
                        '/payments/health'
                    )
                }
            }
        }

        // ============================================================
        // DEPLOY NOTIFICATION SERVICE
        // ============================================================

        stage('Deploy notification-service') {
            steps {
                script {
                    deployService(
                        'notification-service',
                        '/notifications/health'
                    )
                }
            }
        }
    }

    // ================================================================
    // POST ACTIONS
    // ================================================================

    post {

        always {
            sh '''
                echo "=========================================="
                echo "DOCKER CLEANUP"
                echo "=========================================="

                docker image prune -f || true
            '''
        }

        success {
            echo '''
==========================================
DEPLOYMENT SUCCESSFUL
==========================================
All 5 microservices were deployed successfully.
'''
        }

        failure {
            echo '''
==========================================
DEPLOYMENT FAILED
==========================================
Check the stage logs and SSM deployment output.
Any failed service should have attempted rollback.
'''
        }
    }
}


// ====================================================================
// DEPLOYMENT FUNCTION
// ====================================================================

def deployService(String serviceName, String healthPath) {

    echo """
==========================================
DEPLOYING ${serviceName}
==========================================

New version:
${env.IMAGE_TAG}

Health URL:
http://localhost${healthPath}
==========================================
"""

    /*
     * Remote deployment script.
     *
     * IMPORTANT:
     * Everything related to deployment and rollback happens here.
     * No separate .sh file is required on the EC2.
     */

    def remoteScript = """#!/bin/bash

set -u

SERVICE="${serviceName}"
NEW_TAG="${env.IMAGE_TAG}"
PROJECT_DIR="${env.APP_PROJECT_DIR}"
COMPOSE_FILE="\${PROJECT_DIR}/docker-compose.yml"
BACKUP_FILE="\${PROJECT_DIR}/docker-compose.\${SERVICE}.before-deploy"
HEALTH_URL="http://localhost${healthPath}"
ECR_REGISTRY="${env.ECR_REGISTRY}"
AWS_REGION="${env.AWS_REGION}"

echo "============================================================"
echo "SERVICE DEPLOYMENT"
echo "============================================================"
echo "Service:       \$SERVICE"
echo "New version:   \$NEW_TAG"
echo "Health URL:    \$HEALTH_URL"
echo "Project dir:   \$PROJECT_DIR"
echo "============================================================"

cd "\$PROJECT_DIR" || {
    echo "ERROR: Cannot enter project directory."
    exit 10
}


# ================================================================
# FUNCTION: HEALTH CHECK
# ================================================================

health_check() {

    local ATTEMPT=1

    echo ""
    echo "Running health check..."

    while [ \$ATTEMPT -le 5 ]; do

        echo "Health check attempt \$ATTEMPT/5"

        if curl -fsS --max-time 5 "\$HEALTH_URL"; then
            echo ""
            echo "Health check PASSED."
            return 0
        fi

        echo ""
        echo "Health check failed."

        if [ \$ATTEMPT -lt 5 ]; then
            echo "Waiting 5 seconds..."
            sleep 5
        fi

        ATTEMPT=\$((ATTEMPT + 1))
    done

    echo "Health check FAILED after 5 attempts."

    return 1
}


# ================================================================
# FUNCTION: ROLLBACK
# ================================================================

rollback() {

    echo ""
    echo "============================================================"
    echo "STARTING ROLLBACK"
    echo "============================================================"

    if [ ! -f "\$BACKUP_FILE" ]; then
        echo "ERROR: Backup file does not exist:"
        echo "\$BACKUP_FILE"
        return 1
    fi

    echo "Restoring previous docker-compose.yml..."

    cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

    echo "Validating restored Compose file..."

    if ! docker compose config -q; then
        echo "ERROR: Restored Compose file is invalid."
        return 1
    fi

    echo "Restored Compose file is valid."

    echo ""
    echo "Starting previous version..."

    if ! docker compose up -d "\$SERVICE"; then
        echo "ERROR: Failed to start previous version."
        return 1
    fi

    echo ""
    echo "Checking previous version health..."

    if health_check; then

        echo ""
        echo "============================================================"
        echo "ROLLBACK SUCCESSFUL"
        echo "============================================================"

        rm -f "\$BACKUP_FILE"

        return 0

    else

        echo ""
        echo "============================================================"
        echo "CRITICAL ERROR"
        echo "ROLLBACK HEALTH CHECK FAILED"
        echo "============================================================"

        return 1
    fi
}


# ================================================================
# STEP 1: VALIDATE CURRENT COMPOSE FILE
# ================================================================

echo ""
echo "Checking current docker-compose.yml..."

if ! docker compose config -q; then

    echo ""
    echo "WARNING: Current docker-compose.yml is invalid."

    if [ -f "\$BACKUP_FILE" ]; then

        echo "Backup file found."
        echo "Checking backup..."

        if docker compose -f "\$BACKUP_FILE" config -q; then

            echo "Backup is valid."
            echo "Restoring backup..."

            cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

            if ! docker compose config -q; then
                echo "ERROR: Restored Compose file is still invalid."
                exit 11
            fi

            echo "Compose file successfully restored."

        else
            echo "ERROR: Backup file is also invalid."
            exit 12
        fi

    else

        echo "ERROR: No valid backup available."
        exit 13

    fi
fi

echo "Current Compose file is valid."


# ================================================================
# STEP 2: FIND CURRENT IMAGE
# ================================================================

echo ""
echo "Finding currently deployed version..."

CURRENT_IMAGE=\$(docker compose config --images | grep "/\${SERVICE}:" | head -n 1 || true)

if [ -z "\$CURRENT_IMAGE" ]; then

    echo "ERROR: Could not find current image for \$SERVICE."

    echo ""
    echo "Images known by Docker Compose:"
    docker compose config --images || true

    exit 20
fi

PREVIOUS_TAG="\${CURRENT_IMAGE##*:}"

echo "Current image:    \$CURRENT_IMAGE"
echo "Previous version: \$PREVIOUS_TAG"
echo "New version:      \$NEW_TAG"


# ================================================================
# STEP 3: DO NOT DEPLOY IF SAME VERSION
# ================================================================

if [ "\$PREVIOUS_TAG" = "\$NEW_TAG" ]; then

    echo ""
    echo "Service is already running \$NEW_TAG."
    echo "Nothing to deploy."

    exit 0
fi


# ================================================================
# STEP 4: CREATE BACKUP
# ================================================================

echo ""
echo "Creating backup..."

cp "\$COMPOSE_FILE" "\$BACKUP_FILE"

if [ ! -f "\$BACKUP_FILE" ]; then

    echo "ERROR: Could not create backup."
    exit 30

fi

echo "Backup created:"
echo "\$BACKUP_FILE"


# ================================================================
# STEP 5: ECR LOGIN
# ================================================================

echo ""
echo "Logging into ECR..."

if ! aws ecr get-login-password --region "\$AWS_REGION" | \\
    docker login \\
    --username AWS \\
    --password-stdin "\$ECR_REGISTRY"; then

    echo "ERROR: ECR login failed."
    exit 40
fi


# ================================================================
# STEP 6: PULL NEW IMAGE
# ================================================================

echo ""
echo "Pulling new image..."

NEW_IMAGE="\$ECR_REGISTRY/\$SERVICE:\$NEW_TAG"

echo "Image:"
echo "\$NEW_IMAGE"

if ! docker pull "\$NEW_IMAGE"; then

    echo "ERROR: Failed to pull new image."
    echo "No deployment was made."

    exit 50
fi


# ================================================================
# STEP 7: UPDATE ONLY THE SERVICE IMAGE
# ================================================================

echo ""
echo "Updating docker-compose.yml..."

TEMP_FILE="\${COMPOSE_FILE}.tmp"

sed -E \\
    "/^[[:space:]]*image:[[:space:]]*.*\\\\/\${SERVICE}:/ s#(\${SERVICE}:)[^[:space:]]*#\\\\1\${NEW_TAG}#" \\
    "\$COMPOSE_FILE" > "\$TEMP_FILE"

if [ \$? -ne 0 ]; then

    echo "ERROR: Failed to modify docker-compose.yml."

    cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

    exit 60
fi

mv "\$TEMP_FILE" "\$COMPOSE_FILE"


# ================================================================
# STEP 8: VERIFY IMAGE WAS ACTUALLY CHANGED
# ================================================================

echo ""
echo "Checking updated image..."

UPDATED_IMAGE=\$(docker compose config --images | grep "/\${SERVICE}:" | head -n 1 || true)

echo "Updated image:"
echo "\$UPDATED_IMAGE"

EXPECTED_IMAGE="\$ECR_REGISTRY/\$SERVICE:\$NEW_TAG"

if [ "\$UPDATED_IMAGE" != "\$EXPECTED_IMAGE" ]; then

    echo ""
    echo "ERROR: Compose file does not contain expected image."

    echo "Expected:"
    echo "\$EXPECTED_IMAGE"

    echo "Found:"
    echo "\$UPDATED_IMAGE"

    echo ""
    echo "Restoring backup..."

    cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

    exit 61
fi


# ================================================================
# STEP 9: VALIDATE YAML BEFORE DOCKER COMPOSE UP
# ================================================================

echo ""
echo "Validating docker-compose.yml..."

if ! docker compose config -q; then

    echo ""
    echo "ERROR: docker-compose.yml became invalid."
    echo "Deployment will NOT continue."

    echo ""
    echo "Restoring backup..."

    cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

    if docker compose config -q; then
        echo "Previous Compose file restored successfully."
    else
        echo "CRITICAL: Previous Compose file could not be restored."
    fi

    exit 62
fi

echo "Compose YAML validation PASSED."


# ================================================================
# STEP 10: START NEW VERSION
# ================================================================

echo ""
echo "Starting new version..."

if ! docker compose up -d "\$SERVICE"; then

    echo ""
    echo "ERROR: docker compose up failed."

    if ! rollback; then
        echo "CRITICAL: Rollback failed."
        exit 70
    fi

    exit 71
fi


# ================================================================
# STEP 11: NEW VERSION HEALTH CHECK
# ================================================================

echo ""
echo "Checking new version..."

if health_check; then

    echo ""
    echo "============================================================"
    echo "DEPLOYMENT SUCCESSFUL"
    echo "============================================================"
    echo "Service:       \$SERVICE"
    echo "Previous:      \$PREVIOUS_TAG"
    echo "New version:   \$NEW_TAG"
    echo "============================================================"

    rm -f "\$BACKUP_FILE"

    exit 0

fi


# ================================================================
# STEP 12: HEALTH CHECK FAILED → ROLLBACK
# ================================================================

echo ""
echo "============================================================"
echo "NEW VERSION FAILED HEALTH CHECK"
echo "============================================================"

if rollback; then

    echo ""
    echo "============================================================"
    echo "DEPLOYMENT FAILED BUT ROLLBACK SUCCEEDED"
    echo "============================================================"

    echo "Previous version restored:"
    echo "\$PREVIOUS_TAG"

    exit 80

else

    echo ""
    echo "============================================================"
    echo "CRITICAL DEPLOYMENT FAILURE"
    echo "============================================================"
    echo "New version failed."
    echo "Rollback also failed."
    echo "Manual intervention is required."

    exit 81
fi

"""


    // ================================================================
    // CREATE SSM PARAMETERS JSON
    // ================================================================

    def commands = [
        remoteScript
    ]

    def parametersJson = JsonOutput.toJson([
        commands: commands
    ])

    def parametersFile = "ssm-${serviceName}.json"

    writeFile(
        file: parametersFile,
        text: parametersJson
    )


    try {

        // ============================================================
        // SEND SSM COMMAND
        // ============================================================

        echo "Sending deployment command to App EC2..."

        def commandId = sh(
            script: """
                aws ssm send-command \
                    --region ${env.AWS_REGION} \
                    --instance-ids ${env.APP_INSTANCE_ID} \
                    --document-name AWS-RunShellScript \
                    --parameters file://${parametersFile} \
                    --comment "Jenkins deployment ${serviceName} ${env.IMAGE_TAG}" \
                    --query 'Command.CommandId' \
                    --output text
            """,
            returnStdout: true
        ).trim()

        echo "SSM Command ID: ${commandId}"


        // ============================================================
        // WAIT FOR SSM COMMAND
        //
        // We intentionally DO NOT use:
        //
        // aws ssm wait command-executed
        //
        // because when SSM fails, the waiter can hide the useful
        // StandardOutputContent / StandardErrorContent.
        //
        // Instead, we poll get-command-invocation.
        // ============================================================

        def finalStatus = ""

        timeout(time: 10, unit: 'MINUTES') {

            while (true) {

                finalStatus = sh(
                    script: """
                        aws ssm get-command-invocation \
                            --region ${env.AWS_REGION} \
                            --command-id ${commandId} \
                            --instance-id ${env.APP_INSTANCE_ID} \
                            --query 'Status' \
                            --output text
                    """,
                    returnStdout: true
                ).trim()

                echo "SSM status for ${serviceName}: ${finalStatus}"

                if (
                    finalStatus == 'Success' ||
                    finalStatus == 'Failed' ||
                    finalStatus == 'Cancelled' ||
                    finalStatus == 'TimedOut' ||
                    finalStatus == 'Cancelling'
                ) {
                    break
                }

                sleep(time: 5, unit: 'SECONDS')
            }
        }


        // ============================================================
        // ALWAYS GET REMOTE OUTPUT
        // ============================================================

        echo ""
        echo "=========================================="
        echo "SSM DEPLOYMENT OUTPUT"
        echo "=========================================="

        def output = sh(
            script: """
                aws ssm get-command-invocation \
                    --region ${env.AWS_REGION} \
                    --command-id ${commandId} \
                    --instance-id ${env.APP_INSTANCE_ID} \
                    --query 'StandardOutputContent' \
                    --output text
            """,
            returnStdout: true
        ).trim()

        if (output) {
            echo output
        }


        echo ""
        echo "=========================================="
        echo "SSM ERROR OUTPUT"
        echo "=========================================="

        def errorOutput = sh(
            script: """
                aws ssm get-command-invocation \
                    --region ${env.AWS_REGION} \
                    --command-id ${commandId} \
                    --instance-id ${env.APP_INSTANCE_ID} \
                    --query 'StandardErrorContent' \
                    --output text
            """,
            returnStdout: true
        ).trim()

        if (errorOutput && errorOutput != "None") {
            echo errorOutput
        }


        // ============================================================
        // CHECK FINAL STATUS
        // ============================================================

        if (finalStatus != 'Success') {

            error(
                "${serviceName} deployment failed. " +
                "SSM final status: ${finalStatus}"
            )
        }

        echo ""
        echo "=========================================="
        echo "${serviceName} DEPLOYMENT COMPLETED"
        echo "=========================================="

    } finally {

        // ============================================================
        // REMOVE TEMPORARY SSM JSON
        // ============================================================

        sh(
            script: "rm -f ${parametersFile}",
            returnStatus: true
        )
    }
}