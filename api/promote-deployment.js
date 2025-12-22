// Helper function to promote a Vercel deployment to production
// This is called after GitHub commits to ensure automatic production deployment

async function promoteDeploymentToProduction(commitSha, branch = 'site') {
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    
    if (!vercelToken || !vercelProjectId) {
        console.log('[promote-deployment] Vercel credentials not configured, skipping promotion');
        return { success: false, reason: 'Vercel credentials not configured' };
    }
    
    try {
        // First, find the deployment for this commit
        const deploymentsUrl = vercelTeamId
            ? `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&target=preview&gitSource.commitSha=${commitSha}&teamId=${vercelTeamId}`
            : `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&target=preview&gitSource.commitSha=${commitSha}`;
        
        const deploymentsResponse = await fetch(deploymentsUrl, {
            headers: {
                'Authorization': `Bearer ${vercelToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!deploymentsResponse.ok) {
            console.log('[promote-deployment] Failed to fetch deployments:', deploymentsResponse.status);
            return { success: false, reason: 'Failed to fetch deployments' };
        }
        
        const deployments = await deploymentsResponse.json();
        const deployment = deployments.deployments?.[0];
        
        if (!deployment) {
            console.log('[promote-deployment] No deployment found for commit:', commitSha);
            return { success: false, reason: 'No deployment found' };
        }
        
        // Check if deployment is already in production
        if (deployment.target === 'production') {
            console.log('[promote-deployment] Deployment already in production:', deployment.url);
            return { success: true, alreadyProduction: true, url: deployment.url };
        }
        
        // Promote to production
        const promoteUrl = vercelTeamId
            ? `https://api.vercel.com/v13/deployments/${deployment.id}/promote?teamId=${vercelTeamId}`
            : `https://api.vercel.com/v13/deployments/${deployment.id}/promote`;
        
        const promoteResponse = await fetch(promoteUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vercelToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: 'production'
            })
        });
        
        if (!promoteResponse.ok) {
            const errorData = await promoteResponse.json().catch(() => ({}));
            console.error('[promote-deployment] Failed to promote deployment:', promoteResponse.status, errorData);
            return { success: false, reason: 'Failed to promote', error: errorData };
        }
        
        const promoteData = await promoteResponse.json();
        console.log('[promote-deployment] Successfully promoted deployment to production:', promoteData.url);
        
        return { 
            success: true, 
            url: promoteData.url,
            deploymentId: deployment.id
        };
        
    } catch (error) {
        console.error('[promote-deployment] Error promoting deployment:', error);
        return { success: false, reason: 'Exception', error: error.message };
    }
}

module.exports = { promoteDeploymentToProduction };

