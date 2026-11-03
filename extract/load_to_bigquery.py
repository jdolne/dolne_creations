import pandas as pd
import config
from google.cloud import bigquery
from google.oauth2 import service_account
import endpoints.all_houses_for_sale as all_houses_for_sale


SERVICE_ACCOUNT_KEY_DC_HOUSING_PROJECT = config.SERVICE_ACCOUNT_KEY_DC_HOUSING_PROJECT

PROJECT_ID = config.PROJECT_ID
DATASET_ID = config.DATASET_ID
FOR_SALE_HOUSES_TABLE_ID = config.FOR_SALE_HOUSES_TABLE_ID # I think I should make this a variable that requires a value for the table.


def get_bigquery_client() -> bigquery.Client:
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_KEY_DC_HOUSING_PROJECT,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    return bigquery.Client(project=PROJECT_ID, credentials=credentials)

def load_dataframe_to_bigquery(
    client: bigquery.Client,
    df: pd.DataFrame,
    dataset_id: str, #maybe I should add a default value here.
    table_id: str,
    write_disposition: str = "WRITE_TRUNCATE_DATA",
) -> None:
    table_ref = f"{client.project}.{dataset_id}.{table_id}"
    job_config = bigquery.LoadJobConfig(write_disposition=write_disposition)

    load_job = client.load_table_from_dataframe(df, table_ref, job_config=job_config)
    load_job.result()

    table = client.get_table(table_ref)
    print(f"Loaded {load_job.output_rows} rows into {table_ref} "
          f"(table now has {table.num_rows} total rows).")

#ask Claude what this is doing
if __name__ == "__main__": 
    # Crete dataframe
    houses_for_sale_dataframe = all_houses_for_sale.all_houses_for_sale_function()
    # process dataframe
    processed_dataframe = all_houses_for_sale.processing_data(houses_for_sale_dataframe)
    # Create bigquery client
    client = get_bigquery_client()
    # Load data into table
    load_dataframe_to_bigquery(client, processed_dataframe, DATASET_ID, FOR_SALE_HOUSES_TABLE_ID)