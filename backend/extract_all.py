import os
import zipfile
import shutil

zip_path = 'Bhavya-2.zip'
base_target = 'documents'

abs_target = os.path.abspath(base_target)
print("Target absolute path:", abs_target)
os.makedirs(abs_target, exist_ok=True)

mapping = {
    'Bhavya/GA Plan/': ('GA_PLAN', 'ga_plans'),
    'Bhavya/Insurance/': ('INSURANCE', 'insurance'),
    'Bhavya/Registry Certificate/': ('REGISTRY', 'registry'),
    'Bhavya/Stability Booklet/': ('STABILITY_BOOKLET', 'stability'),
    'Bhavya/Survey Certificate/': ('SURVEY_CLASS', 'survey')
}

extracted_counts = {}

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    for member in zip_ref.infolist():
        if member.is_dir():
            continue
        
        filename = member.filename
        
        matched_category = None
        for prefix, (doc_type, folder_name) in mapping.items():
            if filename.startswith(prefix):
                matched_category = (doc_type, folder_name)
                break
        
        if matched_category:
            doc_type, folder_name = matched_category
            target_dir = os.path.join(abs_target, folder_name)
            os.makedirs(target_dir, exist_ok=True)
            
            base_name = os.path.basename(filename)
            if not base_name or base_name.startswith('.'):
                continue
                
            target_file_path = os.path.join(target_dir, base_name)
            
            with zip_ref.open(member) as source, open(target_file_path, 'wb') as target:
                shutil.copyfileobj(source, target)
                
            extracted_counts[doc_type] = extracted_counts.get(doc_type, 0) + 1

print("Extraction completed. Summary:")
for doc_type, count in extracted_counts.items():
    print(f"  {doc_type}: {count} files")

print("Checking if target exists now:", os.path.exists(abs_target))
print("Listing target:", os.listdir(abs_target))
