#!
if grep -q "please-set-me" $GITHUB_WORKSPACE/template.yaml; then
    echo "Replacing \"please-set-me\" with wrapping key arn"
    sed -i='' "s|.please-set-me.|$WRAPPING_KEY_ARN|" $GITHUB_WORKSPACE/template.yaml
    sed -i='' "s|.please-set-me.|$WRAPPING_KEY_ARN|" $GITHUB_WORKSPACE/template.yaml
else
    echo "WARNING!!! Image placeholder text \"please-set-me\" not found - uploading template anyway"
fi