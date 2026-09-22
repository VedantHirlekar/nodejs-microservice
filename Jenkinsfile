import groovy.json.JsonOutput

/*
 * ================================================================
 * Helper function
 * ================================================================
 *
 * Deploy one service through AWS SSM.
 *
 * It:
 * 1. Finds the currently deployed version
 * 2. Backs up docker-compose.yml
 * 3. Pulls the new ECR image
 * 4. Updates the service image
 * 5. Starts the service
 * 6. Performs health checks with retries
 * 7. Rolls back automatically if health checks fail
 */

def deployService(String serviceName, String healthPath) {

    echo ""
    echo "============================================================"
    echo "DEPLOYING ${serviceName}"
    echo "NEW VERSION: ${env.IMAGE_TAG}"
    echo "============================================================"

    def remoteScript = """
#!/bin/bash

set -u

SERVICE="${serviceName}"
NEW_TAG="${env.IMAGE_TAG}"
COMPOSE_FILE="${env.APP_DIRECTORY}/docker-compose.yml"
BACKUP_FILE="${env.APP_DIRECTORY}/docker-compose.\${SERVICE}.before-deploy"
HEALTH_URL="http://localhost${healthPath}"

ECR_REGISTRY="${env.ECR_REGISTRY}"
AWS_REGION="${env.AWS_REGION}"

cd "${env.APP_DIRECTORY}"

echo "============================================================"
echo "SERVICE DEPLOYMENT"
echo "============================================================"

echo "Service:       \$SERVICE"
echo "New version:   \$NEW_TAG"
echo "Health URL:    \$HEALTH_URL"

echo ""
echo "Finding currently deployed version..."

PREVIOUS_TAG=\$(grep -A3 "^  \${SERVICE}:" "\$COMPOSE_FILE" \
    | grep "image:" \
    | sed -E "s#.*\${SERVICE}:([^[:space:]]+).*#\\1#")

if [ -z "\$PREVIOUS_TAG" ]; then
    echo "ERROR: Could not determine previous version."
    exit 10
fi

echo "Previous version: \$PREVIOUS_TAG"

echo ""
echo "Creating backup..."

cp "\$COMPOSE_FILE" "\$BACKUP_FILE"

echo "Backup created: \$BACKUP_FILE"

echo ""
echo "Logging into ECR..."

aws ecr get-login-password --region "\$AWS_REGION" | \
docker login \
    --username AWS \
    --password-stdin "\$ECR_REGISTRY"

if [ \$? -ne 0 ]; then
    echo "ERROR: ECR login failed."
    exit 11
fi

echo ""
echo "Pulling new image..."

docker pull "\$ECR_REGISTRY/\$SERVICE:\$NEW_TAG"

if [ \$? -ne 0 ]; then
    echo "ERROR: Docker image pull failed."
    exit 12
fi

echo ""
echo "Updating docker-compose.yml..."

sed -i \
    "/^[[:space:]]*\${SERVICE}:/,/^[[:space:]]*[a-zA-Z].*:/ s#\${SERVICE}:[^[:space:]]*#\${SERVICE}:\${NEW_TAG}#" \
    "\$COMPOSE_FILE"

echo ""
echo "Checking updated image..."

grep -A3 "^  \${SERVICE}:" "\$COMPOSE_FILE"

echo ""
echo "Starting new version..."

docker compose up -d "\$SERVICE"

if [ \$? -ne 0 ]; then

    echo ""
    echo "ERROR: docker compose failed."
    echo "Starting rollback..."

    cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

    docker compose up -d "\$SERVICE"

    echo "Rollback attempted."

    exit 20
fi

echo ""
echo "Waiting for application startup..."

sleep 10


# ================================================================
# HEALTH CHECK
# ================================================================

HEALTH_CHECK_PASSED=false

for ATTEMPT in 1 2 3 4 5
do

    echo ""
    echo "Health check attempt \$ATTEMPT/5"

    if curl -fsS --max-time 5 "\$HEALTH_URL"; then

        echo ""
        echo "Health check PASSED."

        HEALTH_CHECK_PASSED=true

        break

    else

        echo ""
        echo "Health check FAILED."

        if [ "\$ATTEMPT" -lt 5 ]; then
            echo "Waiting 5 seconds before retry..."
            sleep 5
        fi

    fi

done


# ================================================================
# SUCCESS
# ================================================================

if [ "\$HEALTH_CHECK_PASSED" = true ]; then

    echo ""
    echo "============================================================"
    echo "DEPLOYMENT SUCCESSFUL"
    echo "============================================================"

    echo "Service:          \$SERVICE"
    echo "Previous version: \$PREVIOUS_TAG"
    echo "New version:      \$NEW_TAG"

    echo ""
    echo "Removing deployment backup..."

    rm -f "\$BACKUP_FILE"

    echo ""
    echo "Current container:"

    docker compose ps "\$SERVICE"

    exit 0

fi


# ================================================================
# ROLLBACK
# ================================================================

echo ""
echo "============================================================"
echo "HEALTH CHECK FAILED"
echo "STARTING AUTOMATIC ROLLBACK"
echo "============================================================"

echo "Service: \$SERVICE"
echo "Failed version: \$NEW_TAG"
echo "Rollback version: \$PREVIOUS_TAG"

echo ""
echo "Restoring previous docker-compose.yml..."

cp "\$BACKUP_FILE" "\$COMPOSE_FILE"

echo ""
echo "Starting previous version..."

docker compose up -d "\$SERVICE"

if [ \$? -ne 0 ]; then

    echo ""
    echo "============================================================"
    echo "CRITICAL ERROR"
    echo "ROLLBACK START FAILED"
    echo "============================================================"

    docker compose ps "\$SERVICE"

    exit 30
fi

echo ""
echo "Waiting for rollback..."

sleep 10


# ================================================================
# ROLLBACK HEALTH CHECK
# ================================================================

ROLLBACK_HEALTH_PASSED=false

for ATTEMPT in 1 2 3 4 5
do

    echo ""
    echo "Rollback health check attempt \$ATTEMPT/5"

    if curl -fsS --max-time 5 "\$HEALTH_URL"; then

        echo ""
        echo "Rollback health check PASSED."

        ROLLBACK_HEALTH_PASSED=true

        break

    else

        echo ""
        echo "Rollback health check FAILED."

        if [ "\$ATTEMPT" -lt 5 ]; then
            echo "Waiting 5 seconds before retry..."
            sleep 5
        fi

    fi

done


if [ "\$ROLLBACK_HEALTH_PASSED" = true ]; then

    echo ""
    echo "============================================================"
    echo "ROLLBACK SUCCESSFUL"
    echo "============================================================"

    echo "Service:          \$SERVICE"
    echo "Running version:  \$PREVIOUS_TAG"

    docker compose ps "\$SERVICE"

    rm -f "\$BACKUP_FILE"

    exit 40

fi


# ================================================================
# CRITICAL FAILURE
# ================================================================

echo ""
echo "============================================================"
echo "CRITICAL ERROR"
echo "ROLLBACK ALSO FAILED"
echo "============================================================"

echo "Service: \$SERVICE"

docker compose ps "\$SERVICE"

echo ""
echo "Recent container logs:"

docker compose logs --tail=50 "\$SERVICE"

exit 50
"""

    /*
     * Convert the remote shell script into one JSON-safe
     * AWS SSM command.
     */
    def commandsJson = JsonOutput.toJson([
        commands: [remoteScript]
    ])

    /*
     * Write the JSON to a temporary file.
     * This avoids complicated shell escaping.
     */
    writeFile(
        file: "ssm-${serviceName}.json",
        text: commandsJson
    )

    /*
     * Send deployment command to App EC2.
     */
    def commandId = sh(
        script: """
            aws ssm send-command \
                --region ${env.AWS_REGION} \
                --instance-ids ${env.APP_INSTANCE_ID} \
                --document-name AWS-RunShellScript \
                --parameters file://ssm-${serviceName}.json \
                --query 'Command.CommandId' \
                --output text
        """,
        returnStdout: true
    ).trim()

    echo "SSM Command ID: ${commandId}"

    /*
     * Wait until SSM command finishes.
     */
    sh """
        aws ssm wait command-executed \
            --region ${env.AWS_REGION} \
            --command-id ${commandId} \
            --instance-id ${env.APP_INSTANCE_ID}
    """

    /*
     * Get command output.
     */
    def commandStatus = sh(
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

    echo "SSM status: ${commandStatus}"

    /*
     * Always print remote output.
     */
    sh """
        aws ssm get-command-invocation \
            --region ${env.AWS_REGION} \
            --command-id ${commandId} \
            --instance-id ${env.APP_INSTANCE_ID} \
            --query 'StandardOutputContent' \
            --output text
    """

    /*
     * If remote deployment failed, fail Jenkins.
     */
    if (commandStatus != "Success") {

        echo ""
        echo "============================================================"
        echo "${serviceName} DEPLOYMENT FAILED"
        echo "============================================================"

        error("${serviceName} deployment failed or rollback was triggered.")
    }

    /*
     * Clean temporary JSON file.
     */
    sh """
        rm -f ssm-${serviceName}.json
    """

    echo ""
    echo "============================================================"
    echo "${serviceName} DEPLOYMENT COMPLETED"
    echo "============================================================"
}


pipeline {

    agent any


    // ============================================================
    // ENVIRONMENT
    // ============================================================

    environment {

        AWS_REGION = 'eu-north-1'

        AWS_ACCOUNT_ID = '206003749282'

        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

        IMAGE_TAG = "v${BUILD_NUMBER}"

        APP_INSTANCE_ID = 'i-0609f3bfe8e4522cd'

        APP_DIRECTORY = '/home/ssm-user/nodejs-microservice'
    }


    stages {


        // ========================================================
        // 1. CHECKOUT
        // ========================================================

        stage('Checkout') {

            steps {

                echo "Checking out source code..."

                checkout scm
            }
        }


        // ========================================================
        // 2. CHECK TOOLS
        // ========================================================

        stage('Check Tools') {

            steps {

                sh '''
                    echo "=========================================="
                    echo "JENKINS ENVIRONMENT"
                    echo "=========================================="

                    echo "User:"
                    whoami

                    echo ""
                    echo "Docker:"
                    docker --version

                    echo ""
                    echo "AWS CLI:"
                    aws --version

                    echo ""
                    echo "Build number:"
                    echo "${BUILD_NUMBER}"

                    echo ""
                    echo "Image tag:"
                    echo "${IMAGE_TAG}"

                    echo ""
                    echo "ECR registry:"
                    echo "${ECR_REGISTRY}"
                '''
            }
        }


        // ========================================================
        // 3. ECR LOGIN
        // ========================================================

        stage('ECR Login') {

            steps {

                sh '''
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


        // ========================================================
        // 4. BUILD ALL SERVICES
        // ========================================================

        stage('Build All Images') {

            steps {

                sh '''
                    echo "=========================================="
                    echo "BUILDING ALL 5 SERVICES"
                    echo "=========================================="

                    echo ""
                    echo "Building user-service..."
                    docker build \
                        -t ${ECR_REGISTRY}/user-service:${IMAGE_TAG} \
                        ./user-service

                    echo ""
                    echo "Building product-service..."
                    docker build \
                        -t ${ECR_REGISTRY}/product-service:${IMAGE_TAG} \
                        ./product-service

                    echo ""
                    echo "Building order-service..."
                    docker build \
                        -t ${ECR_REGISTRY}/order-service:${IMAGE_TAG} \
                        ./order-service

                    echo ""
                    echo "Building payment-service..."
                    docker build \
                        -t ${ECR_REGISTRY}/payment-service:${IMAGE_TAG} \
                        ./payment-service

                    echo ""
                    echo "Building notification-service..."
                    docker build \
                        -t ${ECR_REGISTRY}/notification-service:${IMAGE_TAG} \
                        ./notification-service

                    echo ""
                    echo "=========================================="
                    echo "ALL 5 IMAGES BUILT"
                    echo "=========================================="

                    docker images | grep ${IMAGE_TAG}
                '''
            }
        }


        // ========================================================
        // 5. PUSH ALL SERVICES
        // ========================================================

        stage('Push All Images') {

            steps {

                sh '''
                    echo "=========================================="
                    echo "PUSHING ALL 5 IMAGES TO ECR"
                    echo "=========================================="

                    echo ""
                    echo "Pushing user-service..."
                    docker push \
                        ${ECR_REGISTRY}/user-service:${IMAGE_TAG}

                    echo ""
                    echo "Pushing product-service..."
                    docker push \
                        ${ECR_REGISTRY}/product-service:${IMAGE_TAG}

                    echo ""
                    echo "Pushing order-service..."
                    docker push \
                        ${ECR_REGISTRY}/order-service:${IMAGE_TAG}

                    echo ""
                    echo "Pushing payment-service..."
                    docker push \
                        ${ECR_REGISTRY}/payment-service:${IMAGE_TAG}

                    echo ""
                    echo "Pushing notification-service..."
                    docker push \
                        ${ECR_REGISTRY}/notification-service:${IMAGE_TAG}

                    echo ""
                    echo "=========================================="
                    echo "ALL 5 IMAGES PUSHED SUCCESSFULLY"
                    echo "=========================================="
                '''
            }
        }


        // ========================================================
        // 6. DEPLOY USER SERVICE
        // ========================================================

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


        // ========================================================
        // 7. DEPLOY PRODUCT SERVICE
        // ========================================================

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


        // ========================================================
        // 8. DEPLOY ORDER SERVICE
        // ========================================================

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


        // ========================================================
        // 9. DEPLOY PAYMENT SERVICE
        // ========================================================

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


        // ========================================================
        // 10. DEPLOY NOTIFICATION SERVICE
        // ========================================================

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


    // ============================================================
    // POST ACTIONS
    // ============================================================

    post {

        success {

            echo """
            ========================================================
            PIPELINE SUCCESSFUL
            ========================================================

            Build:       ${BUILD_NUMBER}
            Image tag:   ${IMAGE_TAG}

            All 5 services were:

            ✓ Built
            ✓ Pushed to ECR
            ✓ Deployed
            ✓ Health checked

            ========================================================
            """
        }


        failure {

            echo """
            ========================================================
            PIPELINE FAILED
            ========================================================

            Build:       ${BUILD_NUMBER}
            Image tag:   ${IMAGE_TAG}

            One of the deployment stages failed.

            If the failure happened during deployment,
            automatic rollback was attempted.

            Check the deployment stage logs above.

            ========================================================
            """
        }


        always {

            sh '''
                echo "=========================================="
                echo "JENKINS DOCKER CLEANUP"
                echo "=========================================="

                docker image prune -f

                echo ""
                echo "Cleanup completed."
            '''
        }
    }
}