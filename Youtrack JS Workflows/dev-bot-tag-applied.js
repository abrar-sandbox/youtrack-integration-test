const entities = require('@jetbrains/youtrack-scripting-api/entities');

const GITHUB_PAT = '';
// const GITHUB_REPO = 'ideascale/andre';
// const GITHUB_REPO = 'abrar-sandbox/youtrack-integration-test';

exports.rule = entities.Issue.onChange({
    title: 'Dev-bot-tag-applied',
    guard: (ctx) => {
        return ctx.issue.tags.added.has(ctx.devBotTag);
    },
    action: (ctx) => {
        const issue = ctx.issue;

        const addedTag = issue.tags.added.first();
        const payload = {
            event_type: 'youtrack-tag-dev-bot',
            client_payload: {
                issueId: issue.id,
                title: issue.summary,
                description: issue.description,
                tag: addedTag && addedTag.name
                // debug: true
            }
        };

        try {
            const http = require('v1/http');
            const connection = new http.Connection('https://api.github.com');

            connection.addHeader('Accept', 'application/vnd.github+json');
            connection.addHeader('Authorization', `Bearer ${GITHUB_PAT}`);
            connection.addHeader('Content-Type', 'application/json');
            connection.addHeader('X-GitHub-Api-Version', '2022-11-28');

            const response = connection.postSync(`/repos/${GITHUB_REPO}/dispatches`, null, JSON.stringify(payload));

            if (response.isSuccess) {
                console.log('Successfully triggered GitHub workflow for issue: ' + issue.idReadable);
            } else {
                console.error('Failed to trigger GitHub workflow: ' + response.response);
            }
        } catch (error) {
            console.error('Error sending webhook: ' + error.message);
            console.error('Error details: ' + JSON.stringify(error));
        }
    },
    requirements: {
        devBotTag: {
            type: entities.Tag,
            name: 'andre'
        }
    }
});
