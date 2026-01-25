import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import settings
import json
import os
import logging

logger = logging.getLogger(__name__)

# Firebase service account credentials
FIREBASE_CREDENTIALS = {
    "type": "service_account",
    "project_id": "playtraderz",
    "private_key_id": "23eb70b5b3fccbf448fbf40c4f3d804e90024b50",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDTWV/mzQiXsNIH\nWtxzrScLVdiZEzTclziwlm62wDyMbD+R2xBXTIGlhJVzbDRe4qK0MiL8WqnieKrd\nO53ied1nmxaIPn6ws8zyZKG+vlwICpjWdmfkJsV7d/Y4GHTe/fdg8tHFNhjMK7hh\n/NzPFzs1KfSTFiY8Ing0A8nf4GSBw/sXzWQx7P7pspfv+dUd6HIlCbVRm+QJ/yZF\n1LtwEJPUzDBdafOeKDzVz9SUX69OE5OP0UNWzyF1xIdjmq9ZCieP2qQMTdpFTeBL\nDZhKd6EQmYosAW8zVp0fucfosTYQc+gC1T2WMHYlL2RjxgaruUjGpThNCJGY4TQo\nfFvIAKKNAgMBAAECggEABJMSJtI4ReQ/X4ZhcCWGy1GD2yhVxBKH2RagddcqWFW9\neIA31dPjmHwKqhFk/srD/8d4B2NE+xBmjlxMegruNmBed/t2TYfOv05bS+Ad6NSl\n4zpz3DXUn2wEyckJuovfr1sCHFUj60Nk/cX114umretnDknz8OhEFsggNfbK5h4Y\nNfYfF6e5DjLpIMB6SNbWHiDcqe2Udf/qN0ALoPeall/iDSZJQkX7arkpBsNTgJa5\nRU9VMx1nyeq/eE4OZNSvWxcymuQtsNOyDEiAp3rICuDsLtjqTLq8DAwEWhqnHZ0J\n73iydJKrltY40cBeUPrNmDMIhvCH/ms52vNnFuPuVwKBgQD84qfk6r7iJ8wmYrZM\nE95A13DJHSAY0223g9sMFtFDlb/qeaZQlL8G/L/8GS+bzs1q2PkngeHA33u+wFnU\nB1WF1SAflLRrFKNY+3jPwoPn7eXxRpvR23Taj1pvFuhZeICuVEInN1EQabvhqe+d\nEY773mCqhVIicqo+oW1yfIY4WwKBgQDV88FqYjGvC1vIJjHuxLd0LKox/tbctGE1\nKEGI595j1NhmjKAZr8NSamsem8om0rOkD54s5VTOKnIKxXK4sFlei0E0aWGQNy8E\nkAAs95X2vOvkvGl33oIPTdtZhP4mz1PE6htEV6GObW5WySTQxQGAEh1Cnkig9/le\nWZ92Xw5FNwKBgC+vdcVe1pvCsWZTmtiBrpk/hs8FpPXJeJjwTi/bZZ5+8G+AfPIY\n+mSQ6IrbHPUea/HH9EOU5EMAYU846jdnIqNX6vTJj7PZcmvnD4LtxP3JCGEU1XEf\nFsvX2E+2XB3y8SDuVoMalTipF3qYFszhcLrh1gyRk0lXoe6pdf/up0idAoGAFfYC\nSXAw113cGuxIvdB1YDhhc+ZLmbXuMG2kZHAgdLDZUZVnrZtL+j6wJiEpm9iO1e1A\neC1GCi9zK0XfI7P+SGUU2VNjz1DKw7YgPn1faEc2E3F/he1R/k4okMTE7ajkWVcK\nW3Z/P8ZdyAy3ebJvF/1EAZ2LqPIrJ5MdeiIBrfsCgYEAwPir+k2M2FPoj3kr77/3\ni+EQKBR6b3rbt5w5E9GiJKkc5/HTpqW8xJXiMaqh6fCTemXsUr5/vtPH6AsqRrIB\nX0wBicHxaunAa2vf5uxM/aZJG3s1leckgSmLZSTH1kHohBzlwZ7rMCZR9To/6mw/\n8HbCA1aAzw6cwo7ag2tOF2c=\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@playtraderz.iam.gserviceaccount.com",
    "client_id": "104302092122558767093",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40playtraderz.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
}


def init_firebase():
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(FIREBASE_CREDENTIALS)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        raise


def verify_firebase_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded token data"""
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        return None
