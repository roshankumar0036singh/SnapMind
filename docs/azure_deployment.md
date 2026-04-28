# Deploying SnapMind to Microsoft Azure

## 0. Azure for Students (Recommended)
If you have a college ID or student email, you can sign up for **[Azure for Students](https://azure.microsoft.com/en-us/free/students/)**.
- **Benefits**: $100 free credit, no credit card required, and access to "Always Free" services.
- **Setup**: Sign in with your college `.edu` or institution email to verify your status instantly.

Azure provides enterprise-grade hosting with several options that include free, automatic subdomains with SSL.

## 1. Hosting Options & Default Domains

### Option A: Azure Container Apps (Recommended)
This is the most modern way to run Docker containers on Azure. It scales automatically and is very cost-effective.
- **Default Domain**: `https://<app-name>.<random-id>.<region>.azurecontainerapps.io`
- **Pros**: Scales to zero (saves money), automatic SSL, easy GitHub Actions integration.

### Option B: Azure App Service (Web App for Containers)
A more traditional managed service for web applications.
- **Default Domain**: `https://<app-name>.azurewebsites.net`
- **Pros**: Extremely stable, built-in authentication options, easy to manage.

## 2. Deployment Steps (Azure Container Apps)

1. **Create a Container Registry (ACR)**:
   - Go to the Azure Portal -> **Container Registries** -> **Create**.
   - This will store your SnapMind Docker image.

2. **Push your Image**:
   - You can use the GitHub Action we already set up, but point it to your Azure Container Registry instead of GHCR.

3. **Create the Container App**:
   - Go to **Container Apps** -> **Create**.
   - **Container Image**: Select your image from ACR.
   - **Ingress**: 
     - Set to **Enabled**.
     - **Target Port**: `10000`.
     - **Ingress Type**: HTTP.
     - **Insecure connections**: Disabled (force HTTPS).

4. **Environment Variables**:
   - Under **Configuration** -> **Secrets**, add your sensitive keys (DATABASE_URL, GEMINI_API_KEY, etc.).
   - Then map these secrets to environment variables in the container.

## 3. No Domain? No Problem!
The `.azurecontainerapps.io` or `.azurewebsites.net` domains are fully functional, include valid SSL certificates from Microsoft, and can be used directly in your SnapMind extension settings without any extra cost or configuration.

## 4. Maintenance
- **Logs**: Use **Log Analytics** or the **Log Stream** tab in the portal to see your backend output in real-time.
- **Scaling**: Set the "Min Replicas" to 0 if you want to save money when the extension isn't being used, or 1 for instant response times.
